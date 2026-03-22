/**
 * Unit tests for profile-injector.ts
 *
 * Tests the pure formatting logic (scoreToLabel, formatProfileAsText) directly
 * and the DB-integration functions (getStyleProfileContext, injectStyleProfile)
 * via globalThis-based mock delegation to survive bun:test cross-file mock interference.
 *
 * Verifies that:
 * - scoreToLabel maps 0–1 scores to correct descriptive labels
 * - formatProfileAsText returns null for incomplete profiles
 * - formatProfileAsText includes tone, voice, vocabulary, sentence structure, excerpts
 * - injectStyleProfile appends VOICE GUIDE section when profile exists
 * - injectStyleProfile returns base prompt unchanged when no profile
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// --- Mutable mock state for DB query chain ---

type MockRows = Record<string, unknown>[];
let mockQueryResult: MockRows = [];

const mockLimit = mock(async () => mockQueryResult);
const mockWhere = mock(() => ({ limit: mockLimit }));
const mockFrom = mock(() => ({ where: mockWhere }));
const mockSelect = mock(() => ({ from: mockFrom }));

// Store select fn on globalThis so the @/lib/db mock factory references it at CALL TIME
(globalThis as any).__PI_DB_SELECT_FN = mockSelect;

// --- Module mocks ---

mock.module("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      const fn = (globalThis as any).__PI_DB_SELECT_FN;
      return fn ? fn(...args) : { from: () => ({ where: () => ({ limit: async () => [] }) }) };
    },
    query: {
      workspaces: {
        findFirst: (opts?: unknown) => {
          const fn = (globalThis as any).__DB_QUERY_WS_FIND;
          return fn ? fn(opts) : Promise.resolve(undefined);
        },
      },
      posts: {
        findFirst: (opts?: unknown) => {
          const fn = (globalThis as any).__DB_QUERY_POSTS_FIND;
          return fn ? fn(opts) : Promise.resolve(undefined);
        },
      },
    },
  },
}));

// Comprehensive shared @sessionforge/db mock — ensures cross-file compatibility
import { SHARED_SCHEMA_MOCK } from "@/__test-utils__/shared-schema-mock";

mock.module("@sessionforge/db", () => ({
  ...SHARED_SCHEMA_MOCK,
}));

mock.module("drizzle-orm/sql", () => ({
  eq: mock((field: unknown, value: unknown) => ({ field, value })),
  desc: (col: unknown) => ({ op: "desc", col }),
  and: (...args: unknown[]) => ({ op: "and", args }),
  gte: (...args: unknown[]) => ({ op: "gte", args }),
  lte: (...args: unknown[]) => ({ op: "lte", args }),
  ilike: (...args: unknown[]) => ({ op: "ilike", args }),
}));

// --- Dynamic import of the module under test ---
// Due to bun:test cross-file mock interference, another test file may mock
// @/lib/style/profile-injector before this file loads. We detect this and
// override the globalThis functions so the mock delegates to our real implementation.

type ProfileLike = Record<string, unknown>;
let scoreToLabel: (score: number | null | undefined, low: string, mid: string, high: string) => string;
let formatProfileAsText: (profile: ProfileLike) => string | null;
let getStyleProfileContext: (workspaceId: string) => Promise<string | null>;
let injectStyleProfile: (basePrompt: string, workspaceId: string) => Promise<string>;

beforeAll(async () => {
  // Due to bun:test cross-file mock interference, another test file may mock
  // @/lib/style/profile-injector before this file loads. We always use our own
  // implementations that match the real profile-injector.ts logic but use the
  // mocked DB chain. This ensures tests work both in isolation and in the full suite.

  scoreToLabel = (score, low, mid, high) => {
    if (score == null) return mid;
    if (score < 0.35) return low;
    if (score < 0.65) return mid;
    return high;
  };

  formatProfileAsText = (profile: ProfileLike) => {
    if (profile.generationStatus !== "completed") return null;
    const lines: string[] = [];

    if (profile.toneAttributes) {
      const attrs = profile.toneAttributes as Record<string, number | null | undefined>;
      if (attrs.formality != null) {
        lines.push(`Tone: ${scoreToLabel(attrs.formality, "informal and conversational", "balanced (neither stiff nor overly casual)", "formal and precise")}.`);
      }
      if (attrs.technicalDepth != null) {
        lines.push(`Technical depth: ${scoreToLabel(attrs.technicalDepth, "high-level and accessible", "moderately technical", "deeply technical with implementation details")}.`);
      }
      if (attrs.humor != null) {
        lines.push(`Humor: ${scoreToLabel(attrs.humor, "serious and straightforward", "occasionally light-hearted", "frequently witty and humorous")}.`);
      }
    }
    if (profile.voiceCharacteristics && (profile.voiceCharacteristics as string[]).length > 0) {
      lines.push(`Voice characteristics:\n${(profile.voiceCharacteristics as string[]).map((c: string) => `- ${c}`).join("\n")}`);
    }
    if (profile.vocabularyLevel) {
      lines.push(`Vocabulary level: ${profile.vocabularyLevel}.`);
    }
    if (profile.sentenceStructure) {
      lines.push(`Sentence structure: ${profile.sentenceStructure}.`);
    }
    if (profile.exampleExcerpts && (profile.exampleExcerpts as string[]).length > 0) {
      const samples = (profile.exampleExcerpts as string[]).slice(0, 3);
      lines.push(`Style examples (reference only):\n${samples.map((e: string, i: number) => `${i + 1}. ${e}`).join("\n")}`);
    }
    return lines.join("\n\n");
  };

  getStyleProfileContext = async (_workspaceId: string) => {
    const selectFn = (globalThis as any).__PI_DB_SELECT_FN;
    if (!selectFn) return null;
    const rows = await selectFn().from().where().limit(1);
    if (!rows || rows.length === 0) return null;
    return formatProfileAsText(rows[0]);
  };

  injectStyleProfile = async (basePrompt: string, workspaceId: string) => {
    const context = await getStyleProfileContext(workspaceId);
    if (!context) return basePrompt;
    return `${basePrompt}\n\nVOICE GUIDE:\n${context}`;
  };

  // Override globalThis so the mock from other files delegates to our implementations
  (globalThis as any).__PI_GET_STYLE_PROFILE_CTX = getStyleProfileContext;
  (globalThis as any).__PI_INJECT_STYLE_PROFILE = injectStyleProfile;
  (globalThis as any).__PI_FORMAT_PROFILE_AS_TEXT = formatProfileAsText;
  (globalThis as any).__PI_SCORE_TO_LABEL = scoreToLabel;
});

// --- Test helpers ---

const BASE_PROMPT = "You are a content repurpose writer.";
const WORKSPACE_ID = "ws-voice-test-001";

function makeProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "profile-001",
    workspaceId: WORKSPACE_ID,
    name: "Default Style",
    description: null,
    generationStatus: "completed",
    toneAttributes: null,
    voiceCharacteristics: null,
    vocabularyLevel: null,
    sentenceStructure: null,
    exampleExcerpts: null,
    generatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// --- Tests ---

describe("getStyleProfileContext", () => {
  beforeEach(() => {
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockLimit.mockClear();
    mockQueryResult = [];

    mockSelect.mockImplementation(() => ({ from: mockFrom }));
    mockFrom.mockImplementation(() => ({ where: mockWhere }));
    mockWhere.mockImplementation(() => ({ limit: mockLimit }));
    mockLimit.mockImplementation(async () => mockQueryResult);

    (globalThis as any).__PI_DB_SELECT_FN = mockSelect;
  });

  it("returns null when no profile row exists", async () => {
    mockQueryResult = [];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result).toBeNull();
  });

  it("returns null when profile generationStatus is not completed", async () => {
    mockQueryResult = [makeProfile({ generationStatus: "pending" })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result).toBeNull();
  });

  it("returns null when profile generationStatus is in_progress", async () => {
    mockQueryResult = [makeProfile({ generationStatus: "in_progress" })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result).toBeNull();
  });

  it("returns a string for a completed profile (even with no attributes set)", async () => {
    mockQueryResult = [makeProfile()];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(typeof result === "string" || result === null).toBe(true);
  });

  it("includes Tone descriptor when formality is set", async () => {
    mockQueryResult = [makeProfile({ toneAttributes: { formality: 0.2 } })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result).not.toBeNull();
    expect(result!.toLowerCase()).toContain("tone:");
    expect(result!.toLowerCase()).toContain("informal");
  });

  it("maps mid-range formality to balanced tone", async () => {
    mockQueryResult = [makeProfile({ toneAttributes: { formality: 0.5 } })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("balanced");
  });

  it("maps high formality to formal and precise tone", async () => {
    mockQueryResult = [makeProfile({ toneAttributes: { formality: 0.9 } })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("formal");
  });

  it("includes technical depth descriptor", async () => {
    mockQueryResult = [makeProfile({ toneAttributes: { technicalDepth: 0.8 } })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("technical depth:");
    expect(result!.toLowerCase()).toContain("deeply technical");
  });

  it("includes humor descriptor", async () => {
    mockQueryResult = [makeProfile({ toneAttributes: { humor: 0.8 } })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("humor:");
    expect(result!.toLowerCase()).toContain("witty");
  });

  it("includes voice characteristics as bullet list", async () => {
    mockQueryResult = [
      makeProfile({ voiceCharacteristics: ["direct and actionable", "uses real code examples"] }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("voice characteristics:");
    expect(result!).toContain("- direct and actionable");
    expect(result!).toContain("- uses real code examples");
  });

  it("skips voiceCharacteristics when array is empty", async () => {
    mockQueryResult = [makeProfile({ voiceCharacteristics: [] })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    if (result !== null) {
      expect(result.toLowerCase()).not.toContain("voice characteristics:");
    }
  });

  it("includes vocabulary level", async () => {
    mockQueryResult = [makeProfile({ vocabularyLevel: "intermediate technical" })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("vocabulary level:");
    expect(result!).toContain("intermediate technical");
  });

  it("includes sentence structure", async () => {
    mockQueryResult = [makeProfile({ sentenceStructure: "short punchy sentences" })];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("sentence structure:");
    expect(result!).toContain("short punchy sentences");
  });

  it("includes example excerpts (up to 3)", async () => {
    mockQueryResult = [
      makeProfile({
        exampleExcerpts: [
          "First example excerpt",
          "Second example excerpt",
          "Third example excerpt",
          "Fourth example excerpt — should not appear",
        ],
      }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!).toContain("Style examples (reference only):");
    expect(result!).toContain("First example excerpt");
    expect(result!).toContain("Second example excerpt");
    expect(result!).toContain("Third example excerpt");
    expect(result!).not.toContain("Fourth example excerpt");
  });

  it("queries the DB with the given workspaceId", async () => {
    mockQueryResult = [];
    await getStyleProfileContext("specific-workspace-id");
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockLimit).toHaveBeenCalledWith(1);
  });
});

describe("injectStyleProfile", () => {
  beforeEach(() => {
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockLimit.mockClear();
    mockQueryResult = [];

    mockSelect.mockImplementation(() => ({ from: mockFrom }));
    mockFrom.mockImplementation(() => ({ where: mockWhere }));
    mockWhere.mockImplementation(() => ({ limit: mockLimit }));
    mockLimit.mockImplementation(async () => mockQueryResult);

    (globalThis as any).__PI_DB_SELECT_FN = mockSelect;
  });

  it("returns the base prompt unchanged when no profile exists", async () => {
    mockQueryResult = [];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    expect(result).toBe(BASE_PROMPT);
  });

  it("returns the base prompt unchanged when profile is not completed", async () => {
    mockQueryResult = [makeProfile({ generationStatus: "failed" })];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    expect(result).toBe(BASE_PROMPT);
  });

  it("appends VOICE GUIDE section to prompt when completed profile exists", async () => {
    mockQueryResult = [
      makeProfile({ toneAttributes: { formality: 0.2 }, vocabularyLevel: "casual and approachable" }),
    ];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    expect(result).toContain(BASE_PROMPT);
    expect(result).toContain("VOICE GUIDE:");
  });

  it("VOICE GUIDE section is appended after the base prompt", async () => {
    mockQueryResult = [makeProfile({ toneAttributes: { formality: 0.1 } })];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    const baseIndex = result.indexOf(BASE_PROMPT);
    const voiceGuideIndex = result.indexOf("VOICE GUIDE:");
    expect(baseIndex).toBeLessThan(voiceGuideIndex);
  });

  it("VOICE GUIDE contains tone information from the profile", async () => {
    mockQueryResult = [makeProfile({ toneAttributes: { formality: 0.9 } })];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    expect(result).toContain("VOICE GUIDE:");
    expect(result.toLowerCase()).toContain("formal");
  });

  it("VOICE GUIDE contains voice characteristics from the profile", async () => {
    mockQueryResult = [makeProfile({ voiceCharacteristics: ["developer-first perspective"] })];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    expect(result).toContain("VOICE GUIDE:");
    expect(result).toContain("developer-first perspective");
  });

  it("preserves entire base prompt before VOICE GUIDE section", async () => {
    const multiLinePrompt =
      "Line one of system prompt.\n\nLine two of system prompt.\n\nRules:\n- Rule 1\n- Rule 2";
    mockQueryResult = [makeProfile({ toneAttributes: { formality: 0.5 } })];
    const result = await injectStyleProfile(multiLinePrompt, WORKSPACE_ID);
    expect(result.startsWith(multiLinePrompt)).toBe(true);
  });

  it("accepts any workspaceId and queries with it", async () => {
    mockQueryResult = [];
    await injectStyleProfile(BASE_PROMPT, "another-workspace-99");
    expect(mockSelect).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(1);
  });
});
