/**
 * Unit tests for the automation pipeline.
 *
 * Tests cover:
 *   - lookbackWindowToDays() — pure utility function
 *   - executePipeline()     — integration of scan → extract → generate
 *
 * Uses dynamic imports so that mock.module() calls are registered before the
 * module under test (and its transitive dependencies) are loaded.
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared state for db mock
// ---------------------------------------------------------------------------

/** Rows returned by any db.select() chain (both leftJoin and plain). */
let mockSelectRows: unknown[] = [];

/** Collects the `values` argument from every db.update().set() call. */
const mockUpdateSetValues: unknown[] = [];

/** When true, db.select() chains reject. */
let mockDbSelectThrow = false;

/** When true, db.update().set().where() rejects. */
let mockDbUpdateThrow = false;

// ---------------------------------------------------------------------------
// Fake db with chainable API
// ---------------------------------------------------------------------------

const mockDb = {
  update: (_table: unknown) => ({
    set: (values: unknown) => ({
      where: async (_cond: unknown) => {
        if (mockDbUpdateThrow) throw new Error("DB update error");
        mockUpdateSetValues.push(values);
      },
    }),
  }),
  select: (_fields?: unknown) => ({
    from: (_table: unknown) => ({
      leftJoin: (_table2: unknown, _on: unknown) => ({
        where: async (_cond: unknown) => {
          if (mockDbSelectThrow) throw new Error("DB select error");
          return mockSelectRows;
        },
      }),
      where: async (_cond: unknown) => {
        if (mockDbSelectThrow) throw new Error("DB select error");
        return mockSelectRows;
      },
    }),
  }),
};

// ---------------------------------------------------------------------------
// Mock factory functions (stable references)
// ---------------------------------------------------------------------------

const mockScanSessionFiles = mock(async () => [] as { filePath: string }[]);
const mockParseSessionFile = mock(async () => ({ messages: [] }));
const mockNormalizeSession = mock(() => ({}));
const mockIndexSessions = mock(async () => ({
  scanned: 0,
  indexed: 0,
  new: 0,
  updated: 0,
  errors: [] as string[],
}));
const mockExtractInsight = mock(async () => ({ result: null, insight: null }));
const mockGenerateContent = mock(async () => null as null | { postId: string });
const mockFireWebhookEvent = mock(async () => {});

// ---------------------------------------------------------------------------
// Register module mocks BEFORE any dynamic import of the module under test
// ---------------------------------------------------------------------------

mock.module("drizzle-orm/sql", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val, op: "eq" }),
  and: (...args: unknown[]) => ({ args, op: "and" }),
  gte: (col: unknown, val: unknown) => ({ col, val, op: "gte" }),
  isNull: (col: unknown) => ({ col, op: "isNull" }),
}));

// Comprehensive shared @sessionforge/db mock — ensures cross-file compatibility
import { SHARED_SCHEMA_MOCK } from "@/__test-utils__/shared-schema-mock";

mock.module("@sessionforge/db", () => ({
  ...SHARED_SCHEMA_MOCK,
  automationRuns: { id: "automationRuns.id", status: "status", sessionsScanned: "sessionsScanned", insightsExtracted: "insightsExtracted", postId: "postId", completedAt: "completedAt", durationMs: "durationMs", errorMessage: "errorMessage" },
  claudeSessions: { id: "claudeSessions.id", sessionId: "sessionId", workspaceId: "workspaceId", startedAt: "startedAt" },
  contentTriggers: { id: "contentTriggers.id", lastRunAt: "lastRunAt", lastRunStatus: "lastRunStatus" },
  insights: { id: "insights.id", sessionId: "insights.sessionId", workspaceId: "insights.workspaceId", createdAt: "insights.createdAt" },
  workspaces: { id: "workspaces.id" },
}));

mock.module("@/lib/db", () => ({ db: mockDb }));

mock.module("@/lib/sessions/scanner", () => ({
  scanSessionFiles: mockScanSessionFiles,
}));

mock.module("@/lib/sessions/parser", () => ({
  parseSessionFile: mockParseSessionFile,
}));

mock.module("@/lib/sessions/normalizer", () => ({
  normalizeSession: mockNormalizeSession,
}));

mock.module("@/lib/sessions/indexer", () => ({
  indexSessions: mockIndexSessions,
}));

mock.module("@/lib/ai/agents/insight-extractor", () => ({
  extractInsight: mockExtractInsight,
}));

mock.module("@/lib/automation/content-generator", () => ({
  generateContent: mockGenerateContent,
}));

mock.module("@/lib/webhooks/events", () => ({
  fireWebhookEvent: mockFireWebhookEvent,
}));

// ---------------------------------------------------------------------------
// Dynamic import of module under test
// ---------------------------------------------------------------------------

let lookbackWindowToDays: (window: string) => number;
let executePipeline: (
  runId: string,
  trigger: Record<string, unknown>,
  workspace: Record<string, unknown>
) => Promise<void>;

beforeAll(async () => {
  const mod = await import("../pipeline");
  lookbackWindowToDays = mod.lookbackWindowToDays;
  executePipeline = mod.executePipeline as typeof executePipeline;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrigger(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "trigger-001",
    workspaceId: "ws-001",
    contentType: "changelog",
    lookbackWindow: "last_7_days",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastRunAt: null,
    lastRunStatus: null,
    ...overrides,
  };
}

function makeWorkspace(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ws-001",
    sessionBasePath: "/home/user/.claude",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("lookbackWindowToDays", () => {
  it("maps current_day to 1", () => {
    expect(lookbackWindowToDays("current_day")).toBe(1);
  });

  it("maps yesterday to 1", () => {
    expect(lookbackWindowToDays("yesterday")).toBe(1);
  });

  it("maps last_7_days to 7", () => {
    expect(lookbackWindowToDays("last_7_days")).toBe(7);
  });

  it("maps last_14_days to 14", () => {
    expect(lookbackWindowToDays("last_14_days")).toBe(14);
  });

  it("maps last_30_days to 30", () => {
    expect(lookbackWindowToDays("last_30_days")).toBe(30);
  });

  it("maps custom to 7", () => {
    expect(lookbackWindowToDays("custom")).toBe(7);
  });

  it("maps unknown values to 7 as default", () => {
    expect(lookbackWindowToDays("some_unknown_window")).toBe(7);
  });
});

describe("executePipeline", () => {
  const RUN_ID = "run-abc-123";

  beforeEach(() => {
    // Reset shared state
    mockSelectRows = [];
    mockUpdateSetValues.length = 0;
    mockDbSelectThrow = false;
    mockDbUpdateThrow = false;

    // Reset mocks
    mockScanSessionFiles.mockClear();
    mockParseSessionFile.mockClear();
    mockNormalizeSession.mockClear();
    mockIndexSessions.mockClear();
    mockExtractInsight.mockClear();
    mockGenerateContent.mockClear();
    mockFireWebhookEvent.mockClear();

    // Re-establish default implementations
    mockScanSessionFiles.mockImplementation(async () => []);
    mockParseSessionFile.mockImplementation(async () => ({ messages: [] }));
    mockNormalizeSession.mockImplementation(() => ({}));
    mockIndexSessions.mockImplementation(async () => ({
      scanned: 0,
      indexed: 0,
      new: 0,
      updated: 0,
      errors: [],
    }));
    mockExtractInsight.mockImplementation(async () => ({ result: null, insight: null }));
    mockGenerateContent.mockImplementation(async () => null);
    mockFireWebhookEvent.mockImplementation(async () => {});
  });

  // -------------------------------------------------------------------------
  // Session scanning
  // -------------------------------------------------------------------------

  describe("session scanning", () => {
    it("calls scanSessionFiles with the computed lookback days", async () => {
      await executePipeline(RUN_ID, makeTrigger({ lookbackWindow: "last_14_days" }), makeWorkspace());
      expect(mockScanSessionFiles).toHaveBeenCalledWith(14, expect.any(String));
    });

    it("uses workspace sessionBasePath when set", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace({ sessionBasePath: "/custom/path" }));
      expect(mockScanSessionFiles).toHaveBeenCalledWith(expect.any(Number), "/custom/path");
    });

    it("falls back to ~/.claude when sessionBasePath is null", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace({ sessionBasePath: null }));
      expect(mockScanSessionFiles).toHaveBeenCalledWith(expect.any(Number), "~/.claude");
    });

    it("calls parseSessionFile for each scanned file", async () => {
      mockScanSessionFiles.mockImplementation(async () => [
        { filePath: "/path/a.jsonl" },
        { filePath: "/path/b.jsonl" },
      ]);
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      expect(mockParseSessionFile).toHaveBeenCalledTimes(2);
    });

    it("calls normalizeSession for each parsed file", async () => {
      mockScanSessionFiles.mockImplementation(async () => [
        { filePath: "/path/a.jsonl" },
      ]);
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      expect(mockNormalizeSession).toHaveBeenCalledTimes(1);
    });

    it("calls indexSessions with the workspace id and normalized sessions", async () => {
      mockScanSessionFiles.mockImplementation(async () => [{ filePath: "/f.jsonl" }]);
      const fakeNormalized = { sessionId: "s1" };
      mockNormalizeSession.mockImplementation(() => fakeNormalized);

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace({ id: "my-ws" }));

      expect(mockIndexSessions).toHaveBeenCalledWith("my-ws", [fakeNormalized]);
    });

    it("sets run status to scanning before scanning", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      const scanningUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "scanning"
      );
      expect(scanningUpdate).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Insight extraction
  // -------------------------------------------------------------------------

  describe("insight extraction", () => {
    it("sets run status to extracting after scanning", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      const extractingUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "extracting"
      );
      expect(extractingUpdate).toBeDefined();
    });

    it("calls extractInsight for each session returned by the select query", async () => {
      // The leftJoin query returns sessions without insights
      mockSelectRows = [
        { id: "db-session-1", sessionId: "sess-aaa" },
        { id: "db-session-2", sessionId: "sess-bbb" },
      ];

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace({ id: "my-ws" }));

      expect(mockExtractInsight).toHaveBeenCalledTimes(2);
    });

    it("calls extractInsight with the correct workspaceId and sessionId", async () => {
      mockSelectRows = [{ id: "db-1", sessionId: "sess-xyz" }];

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace({ id: "ws-extract" }));

      expect(mockExtractInsight).toHaveBeenCalledWith({
        workspaceId: "ws-extract",
        sessionId: "sess-xyz",
      });
    });

    it("does not call extractInsight when no sessions need extraction", async () => {
      mockSelectRows = [];
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      expect(mockExtractInsight).not.toHaveBeenCalled();
    });

    it("continues to generate content even when extractInsight throws", async () => {
      mockSelectRows = [{ id: "db-1", sessionId: "s1" }];
      mockExtractInsight.mockImplementation(async () => {
        throw new Error("extraction failure");
      });

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("records correct insightsExtracted count in run update", async () => {
      mockSelectRows = [
        { id: "db-1", sessionId: "s1" },
        { id: "db-2", sessionId: "s2" },
      ];
      // First succeeds, second fails
      mockExtractInsight
        .mockImplementationOnce(async () => ({ result: "ok", insight: null }))
        .mockImplementationOnce(async () => { throw new Error("fail"); });

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      const extractUpdate = mockUpdateSetValues.find(
        (v) => typeof (v as Record<string, unknown>).insightsExtracted === "number"
      ) as Record<string, unknown> | undefined;
      expect(extractUpdate?.insightsExtracted).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Content generation
  // -------------------------------------------------------------------------

  describe("content generation", () => {
    it("sets run status to generating before generating", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      const generatingUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "generating"
      );
      expect(generatingUpdate).toBeDefined();
    });

    it("calls generateContent with the workspaceId", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace({ id: "gen-ws" }));
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "gen-ws" })
      );
    });

    it("passes the correct contentType to generateContent", async () => {
      await executePipeline(RUN_ID, makeTrigger({ contentType: "twitter_thread" }), makeWorkspace());
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: "twitter_thread" })
      );
    });

    it("passes lookbackDays derived from the trigger's lookbackWindow", async () => {
      await executePipeline(
        RUN_ID,
        makeTrigger({ lookbackWindow: "last_30_days" }),
        makeWorkspace()
      );
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({ lookbackDays: 30 })
      );
    });

    it("sets run status to complete after successful generation", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      const completeUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "complete"
      );
      expect(completeUpdate).toBeDefined();
    });

    it("stores the postId from generateContent result in the run update", async () => {
      mockGenerateContent.mockImplementation(async () => ({ postId: "post-abc" }));

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      const completeUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "complete"
      ) as Record<string, unknown> | undefined;
      expect(completeUpdate?.postId).toBe("post-abc");
    });

    it("stores null postId when generateContent returns null", async () => {
      mockGenerateContent.mockImplementation(async () => null);

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      const completeUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "complete"
      ) as Record<string, unknown> | undefined;
      expect(completeUpdate?.postId).toBeNull();
    });

    it("updates contentTrigger lastRunStatus to success on completion", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      const triggerSuccessUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).lastRunStatus === "success"
      );
      expect(triggerSuccessUpdate).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Webhook events
  // -------------------------------------------------------------------------

  describe("webhook events", () => {
    it("fires a webhook event on successful completion", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      expect(mockFireWebhookEvent).toHaveBeenCalled();
    });

    it("fires webhook with automation.completed event name", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace({ id: "ws-hook" }));
      expect(mockFireWebhookEvent).toHaveBeenCalledWith(
        "ws-hook",
        "automation.completed",
        expect.any(Object)
      );
    });

    it("fires webhook with status complete on success", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());
      const payload = mockFireWebhookEvent.mock.calls[0][2] as Record<string, unknown>;
      expect(payload.status).toBe("complete");
    });

    it("includes runId in webhook payload", async () => {
      await executePipeline("special-run-999", makeTrigger(), makeWorkspace());
      const payload = mockFireWebhookEvent.mock.calls[0][2] as Record<string, unknown>;
      expect(payload.runId).toBe("special-run-999");
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("updates run status to failed when scanSessionFiles throws", async () => {
      mockScanSessionFiles.mockImplementation(async () => {
        throw new Error("filesystem error");
      });

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      const failedUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "failed"
      );
      expect(failedUpdate).toBeDefined();
    });

    it("stores the error message in the run update when an error occurs", async () => {
      mockScanSessionFiles.mockImplementation(async () => {
        throw new Error("Filesystem unavailable");
      });

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      const failedUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "failed"
      ) as Record<string, unknown> | undefined;
      expect(failedUpdate?.errorMessage).toContain("Filesystem unavailable");
    });

    it("sets trigger lastRunStatus to failed on error", async () => {
      mockScanSessionFiles.mockImplementation(async () => {
        throw new Error("scan fail");
      });

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      const triggerFailUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).lastRunStatus === "failed"
      );
      expect(triggerFailUpdate).toBeDefined();
    });

    it("fires webhook with status failed on error", async () => {
      mockScanSessionFiles.mockImplementation(async () => {
        throw new Error("bad scan");
      });

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace({ id: "ws-fail" }));

      expect(mockFireWebhookEvent).toHaveBeenCalledWith(
        "ws-fail",
        "automation.completed",
        expect.objectContaining({ status: "failed" })
      );
    });

    it("does not throw — executePipeline resolves even on fatal error", async () => {
      mockScanSessionFiles.mockImplementation(async () => {
        throw new Error("fatal");
      });

      await expect(
        executePipeline(RUN_ID, makeTrigger(), makeWorkspace())
      ).resolves.toBeUndefined();
    });

    it("updates run status to failed when generateContent throws", async () => {
      mockGenerateContent.mockImplementation(async () => {
        throw new Error("generation failed");
      });

      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      const failedUpdate = mockUpdateSetValues.find(
        (v) => (v as Record<string, unknown>).status === "failed"
      );
      expect(failedUpdate).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Status transition ordering
  // -------------------------------------------------------------------------

  describe("status transition ordering", () => {
    it("transitions status in order: scanning → extracting → generating → complete", async () => {
      await executePipeline(RUN_ID, makeTrigger(), makeWorkspace());

      const statuses = mockUpdateSetValues
        .filter((v) => typeof (v as Record<string, unknown>).status === "string")
        .map((v) => (v as Record<string, unknown>).status as string);

      const scanIdx = statuses.indexOf("scanning");
      const extractIdx = statuses.indexOf("extracting");
      const generateIdx = statuses.indexOf("generating");
      const completeIdx = statuses.indexOf("complete");

      expect(scanIdx).toBeGreaterThanOrEqual(0);
      expect(extractIdx).toBeGreaterThan(scanIdx);
      expect(generateIdx).toBeGreaterThan(extractIdx);
      expect(completeIdx).toBeGreaterThan(generateIdx);
    });
  });
});
