/**
 * Unit tests for the session indexer (database upsert logic).
 *
 * The database module is replaced with a controllable in-memory fake so that
 * tests run without a real database connection.
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { NormalizedSession } from "../normalizer";

// ---------------------------------------------------------------------------
// Mutable state shared between mock factory and test cases
// ---------------------------------------------------------------------------

/** Controls what db.select()…limit() resolves with. */
let mockSelectResult: { id: number }[] = [];

/** When true, the next db operation will throw. */
let mockThrowOnSelect = false;
let mockThrowOnWrite = false;

/** Tracks which db write operations were executed. */
let mockInsertCalled = false;
let mockUpdateCalled = false;

// ---------------------------------------------------------------------------
// Fake db object with a chainable query-builder interface
// ---------------------------------------------------------------------------

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => {
          if (mockThrowOnSelect) {
            return Promise.reject(new Error("DB select error"));
          }
          return Promise.resolve(mockSelectResult);
        },
      }),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => {
        if (mockThrowOnWrite) {
          return Promise.reject(new Error("DB write error"));
        }
        mockUpdateCalled = true;
        return Promise.resolve();
      },
    }),
  }),
  insert: () => ({
    values: () => {
      if (mockThrowOnWrite) {
        return Promise.reject(new Error("DB write error"));
      }
      mockInsertCalled = true;
      return Promise.resolve();
    },
  }),
};

// Replace the real db module before the indexer is imported.
mock.module("@/lib/db", () => ({ db: mockDb }));

// eslint-disable-next-line import/first
import { indexSessions } from "../indexer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<NormalizedSession> = {}): NormalizedSession {
  return {
    sessionId: "session-abc-123",
    projectPath: "/Users/nick/my-project",
    projectName: "my-project",
    filePath: "/Users/nick/.claude/projects/-Users-nick-my-project/sessions/session-abc-123.jsonl",
    messageCount: 10,
    toolsUsed: ["Read", "Write"],
    filesModified: ["/src/index.ts"],
    errorsEncountered: [],
    costUsd: 0.05,
    startedAt: new Date("2024-06-01T09:00:00.000Z"),
    endedAt: new Date("2024-06-01T09:30:00.000Z"),
    durationSeconds: 1800,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("indexSessions", () => {
  beforeEach(() => {
    mockSelectResult = [];
    mockThrowOnSelect = false;
    mockThrowOnWrite = false;
    mockInsertCalled = false;
    mockUpdateCalled = false;
  });

  // -------------------------------------------------------------------------
  // Empty input
  // -------------------------------------------------------------------------

  describe("empty sessions list", () => {
    it("returns zeroed IndexResult when sessions array is empty", async () => {
      const result = await indexSessions("ws-1", []);
      expect(result).toEqual({
        scanned: 0,
        indexed: 0,
        new: 0,
        updated: 0,
        errors: [],
      });
    });

    it("does not attempt any db operations when sessions array is empty", async () => {
      await indexSessions("ws-1", []);
      expect(mockInsertCalled).toBe(false);
      expect(mockUpdateCalled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Insert path (no existing record)
  // -------------------------------------------------------------------------

  describe("new session insertion", () => {
    it("inserts a new session when no existing record is found", async () => {
      mockSelectResult = [];
      const result = await indexSessions("ws-1", [makeSession()]);
      expect(mockInsertCalled).toBe(true);
    });

    it("increments new count for each inserted session", async () => {
      mockSelectResult = [];
      const result = await indexSessions("ws-1", [makeSession(), makeSession({ sessionId: "other-session" })]);
      expect(result.new).toBe(2);
    });

    it("does not increment updated count when inserting", async () => {
      mockSelectResult = [];
      const result = await indexSessions("ws-1", [makeSession()]);
      expect(result.updated).toBe(0);
    });

    it("returns scanned equal to input length", async () => {
      mockSelectResult = [];
      const result = await indexSessions("ws-1", [makeSession(), makeSession({ sessionId: "s2" })]);
      expect(result.scanned).toBe(2);
    });

    it("returns indexed equal to new + updated on insert path", async () => {
      mockSelectResult = [];
      const result = await indexSessions("ws-1", [makeSession(), makeSession({ sessionId: "s2" })]);
      expect(result.indexed).toBe(result.new + result.updated);
      expect(result.indexed).toBe(2);
    });

    it("returns empty errors array on success", async () => {
      mockSelectResult = [];
      const result = await indexSessions("ws-1", [makeSession()]);
      expect(result.errors).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Update path (existing record found)
  // -------------------------------------------------------------------------

  describe("existing session update", () => {
    it("updates session when an existing record is found", async () => {
      mockSelectResult = [{ id: 42 }];
      await indexSessions("ws-1", [makeSession()]);
      expect(mockUpdateCalled).toBe(true);
    });

    it("does not insert when an existing record is found", async () => {
      mockSelectResult = [{ id: 42 }];
      await indexSessions("ws-1", [makeSession()]);
      expect(mockInsertCalled).toBe(false);
    });

    it("increments updated count for each updated session", async () => {
      mockSelectResult = [{ id: 42 }];
      const result = await indexSessions("ws-1", [makeSession()]);
      expect(result.updated).toBe(1);
      expect(result.new).toBe(0);
    });

    it("returns correct counts when multiple sessions are updated", async () => {
      mockSelectResult = [{ id: 42 }];
      const result = await indexSessions("ws-1", [
        makeSession(),
        makeSession({ sessionId: "s2" }),
      ]);
      expect(result.updated).toBe(2);
      expect(result.new).toBe(0);
      expect(result.indexed).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed insert / update
  // -------------------------------------------------------------------------

  describe("mixed insert and update", () => {
    it("correctly counts new and updated when some sessions exist and others do not", async () => {
      // We simulate alternating: first call returns existing, second returns empty
      let callCount = 0;
      const originalSelect = mockDb.select;
      mockDb.select = () => ({
        from: () => ({
          where: () => ({
            limit: () => {
              callCount++;
              // Odd calls: existing, even calls: new
              return Promise.resolve(callCount % 2 === 1 ? [{ id: 1 }] : []);
            },
          }),
        }),
      });

      const result = await indexSessions("ws-1", [
        makeSession({ sessionId: "existing" }),
        makeSession({ sessionId: "new" }),
      ]);

      mockDb.select = originalSelect;

      expect(result.updated).toBe(1);
      expect(result.new).toBe(1);
      expect(result.indexed).toBe(2);
      expect(result.scanned).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("records error message when db operation throws", async () => {
      mockThrowOnSelect = true;
      const result = await indexSessions("ws-1", [makeSession({ sessionId: "bad-session" })]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("bad-session");
    });

    it("error message contains the session id", async () => {
      mockThrowOnSelect = true;
      const result = await indexSessions("ws-1", [makeSession({ sessionId: "fail-me" })]);
      expect(result.errors[0]).toContain("fail-me");
    });

    it("error message contains the error text", async () => {
      mockThrowOnSelect = true;
      const result = await indexSessions("ws-1", [makeSession()]);
      expect(result.errors[0]).toContain("DB select error");
    });

    it("does not count failed sessions in indexed", async () => {
      mockThrowOnSelect = true;
      const result = await indexSessions("ws-1", [makeSession()]);
      expect(result.indexed).toBe(0);
      expect(result.new).toBe(0);
      expect(result.updated).toBe(0);
    });

    it("continues processing remaining sessions after one failure", async () => {
      let callCount = 0;
      const originalSelect = mockDb.select;
      mockDb.select = () => ({
        from: () => ({
          where: () => ({
            limit: () => {
              callCount++;
              if (callCount === 1) {
                return Promise.reject(new Error("first session fails"));
              }
              return Promise.resolve([]);
            },
          }),
        }),
      });

      const result = await indexSessions("ws-1", [
        makeSession({ sessionId: "will-fail" }),
        makeSession({ sessionId: "will-succeed" }),
      ]);

      mockDb.select = originalSelect;

      expect(result.scanned).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.new).toBe(1);
      expect(result.indexed).toBe(1);
    });

    it("collects multiple errors from multiple failed sessions", async () => {
      mockThrowOnSelect = true;
      const result = await indexSessions("ws-1", [
        makeSession({ sessionId: "s1" }),
        makeSession({ sessionId: "s2" }),
        makeSession({ sessionId: "s3" }),
      ]);
      expect(result.errors).toHaveLength(3);
      expect(result.indexed).toBe(0);
    });

    it("handles non-Error thrown values by stringifying them", async () => {
      const originalSelect = mockDb.select;
      mockDb.select = () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.reject("string error value"),
          }),
        }),
      });

      const result = await indexSessions("ws-1", [makeSession({ sessionId: "str-err" })]);

      mockDb.select = originalSelect;

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("str-err");
    });

    it("records error when the write operation throws", async () => {
      mockSelectResult = [];
      mockThrowOnWrite = true;
      const result = await indexSessions("ws-1", [makeSession({ sessionId: "write-fail" })]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("write-fail");
      expect(result.indexed).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  describe("IndexResult shape", () => {
    it("always returns all expected fields", async () => {
      const result = await indexSessions("ws-1", []);
      expect(result).toHaveProperty("scanned");
      expect(result).toHaveProperty("indexed");
      expect(result).toHaveProperty("new");
      expect(result).toHaveProperty("updated");
      expect(result).toHaveProperty("errors");
    });

    it("scanned equals the number of input sessions regardless of outcome", async () => {
      mockThrowOnSelect = true;
      const result = await indexSessions("ws-1", [
        makeSession({ sessionId: "s1" }),
        makeSession({ sessionId: "s2" }),
        makeSession({ sessionId: "s3" }),
      ]);
      expect(result.scanned).toBe(3);
    });

    it("indexed always equals new + updated", async () => {
      mockSelectResult = [];
      const result = await indexSessions("ws-1", [makeSession()]);
      expect(result.indexed).toBe(result.new + result.updated);
    });
  });

  // -------------------------------------------------------------------------
  // workspaceId handling
  // -------------------------------------------------------------------------

  describe("workspaceId parameter", () => {
    it("accepts any non-empty workspaceId string", async () => {
      mockSelectResult = [];
      const result = await indexSessions("workspace-xyz-999", [makeSession()]);
      expect(result.new).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});
