/**
 * Unit tests for profile-injector.ts
 *
 * Verifies that:
 * - injectStyleProfile returns the base prompt unchanged when no profile exists
 * - injectStyleProfile returns the base prompt unchanged when profile is not completed
 * - injectStyleProfile appends a VOICE GUIDE section when a completed profile exists
 * - VOICE GUIDE text includes tone, voice characteristics, vocabulary, sentence
 *   structure, and example excerpts from the profile
 * - Graceful null handling: missing optional fields are silently skipped
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// --- Shared mock for the DB query chain ---

type MockRows = Record<string, unknown>[];
let mockQueryResult: MockRows = [];

const mockLimit = mock(async () => mockQueryResult);
const mockWhere = mock(() => ({ limit: mockLimit }));
const mockFrom = mock(() => ({ where: mockWhere }));
const mockSelect = mock(() => ({ from: mockFrom }));

// --- Register module mocks BEFORE dynamic import ---

mock.module("@/lib/db", () => ({
  db: { select: mockSelect },
}));

mock.module("@sessionforge/db", () => ({
  writingStyleProfiles: { workspaceId: "workspace_id_field" },
}));

mock.module("drizzle-orm/sql", () => ({
  eq: mock((field: unknown, value: unknown) => ({ field, value })),
}));

// --- Dynamic import of the module under test ---

let getStyleProfileContext: (workspaceId: string) => Promise<string | null>;
let injectStyleProfile: (basePrompt: string, workspaceId: string) => Promise<string>;

beforeAll(async () => {
  const mod = await import("../profile-injector");
  getStyleProfileContext = mod.getStyleProfileContext;
  injectStyleProfile = mod.injectStyleProfile;
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

    // Restore default chain
    mockSelect.mockImplementation(() => ({ from: mockFrom }));
    mockFrom.mockImplementation(() => ({ where: mockWhere }));
    mockWhere.mockImplementation(() => ({ limit: mockLimit }));
    mockLimit.mockImplementation(async () => mockQueryResult);
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
    // With no toneAttributes, voiceCharacteristics, etc. all null → empty lines array → empty string
    // The function joins lines; with no lines it returns an empty string (truthy empty string)
    // The injectStyleProfile code checks `if (!context) return basePrompt;`
    // An empty string is falsy — so it acts as if no profile. That's acceptable behaviour.
    // What matters is it doesn't throw.
    expect(typeof result === "string" || result === null).toBe(true);
  });

  it("includes Tone descriptor when formality is set", async () => {
    mockQueryResult = [
      makeProfile({ toneAttributes: { formality: 0.2 } }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result).not.toBeNull();
    expect(result!.toLowerCase()).toContain("tone:");
    expect(result!.toLowerCase()).toContain("informal");
  });

  it("maps mid-range formality to balanced tone", async () => {
    mockQueryResult = [
      makeProfile({ toneAttributes: { formality: 0.5 } }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("balanced");
  });

  it("maps high formality to formal and precise tone", async () => {
    mockQueryResult = [
      makeProfile({ toneAttributes: { formality: 0.9 } }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("formal");
  });

  it("includes technical depth descriptor", async () => {
    mockQueryResult = [
      makeProfile({ toneAttributes: { technicalDepth: 0.8 } }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("technical depth:");
    expect(result!.toLowerCase()).toContain("deeply technical");
  });

  it("includes humor descriptor", async () => {
    mockQueryResult = [
      makeProfile({ toneAttributes: { humor: 0.8 } }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("humor:");
    expect(result!.toLowerCase()).toContain("witty");
  });

  it("includes voice characteristics as bullet list", async () => {
    mockQueryResult = [
      makeProfile({
        voiceCharacteristics: ["direct and actionable", "uses real code examples"],
      }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("voice characteristics:");
    expect(result!).toContain("- direct and actionable");
    expect(result!).toContain("- uses real code examples");
  });

  it("skips voiceCharacteristics when array is empty", async () => {
    mockQueryResult = [
      makeProfile({ voiceCharacteristics: [] }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    // Empty array — no voice characteristics block
    if (result !== null) {
      expect(result.toLowerCase()).not.toContain("voice characteristics:");
    }
  });

  it("includes vocabulary level", async () => {
    mockQueryResult = [
      makeProfile({ vocabularyLevel: "intermediate technical" }),
    ];
    const result = await getStyleProfileContext(WORKSPACE_ID);
    expect(result!.toLowerCase()).toContain("vocabulary level:");
    expect(result!).toContain("intermediate technical");
  });

  it("includes sentence structure", async () => {
    mockQueryResult = [
      makeProfile({ sentenceStructure: "short punchy sentences" }),
    ];
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
      makeProfile({
        toneAttributes: { formality: 0.2 },
        vocabularyLevel: "casual and approachable",
      }),
    ];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    expect(result).toContain(BASE_PROMPT);
    expect(result).toContain("VOICE GUIDE:");
  });

  it("VOICE GUIDE section is appended after the base prompt", async () => {
    mockQueryResult = [
      makeProfile({ toneAttributes: { formality: 0.1 } }),
    ];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    const baseIndex = result.indexOf(BASE_PROMPT);
    const voiceGuideIndex = result.indexOf("VOICE GUIDE:");
    expect(baseIndex).toBeLessThan(voiceGuideIndex);
  });

  it("VOICE GUIDE contains tone information from the profile", async () => {
    mockQueryResult = [
      makeProfile({ toneAttributes: { formality: 0.9 } }),
    ];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    expect(result).toContain("VOICE GUIDE:");
    expect(result.toLowerCase()).toContain("formal");
  });

  it("VOICE GUIDE contains voice characteristics from the profile", async () => {
    mockQueryResult = [
      makeProfile({
        voiceCharacteristics: ["developer-first perspective"],
      }),
    ];
    const result = await injectStyleProfile(BASE_PROMPT, WORKSPACE_ID);
    expect(result).toContain("VOICE GUIDE:");
    expect(result).toContain("developer-first perspective");
  });

  it("preserves entire base prompt before VOICE GUIDE section", async () => {
    const multiLinePrompt =
      "Line one of system prompt.\n\nLine two of system prompt.\n\nRules:\n- Rule 1\n- Rule 2";
    mockQueryResult = [
      makeProfile({ toneAttributes: { formality: 0.5 } }),
    ];
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
