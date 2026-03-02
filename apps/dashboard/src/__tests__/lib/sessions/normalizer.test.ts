import { describe, it, expect } from "vitest";
import { normalizeSession, type NormalizedSession } from "@/lib/sessions/normalizer";
import type { SessionFileMeta } from "@/lib/sessions/scanner";
import type { ParsedSession } from "@/lib/sessions/parser";

// Helpers for building test fixtures with sensible defaults

function makeMeta(overrides: Partial<SessionFileMeta> = {}): SessionFileMeta {
  return {
    filePath: "/home/user/.claude/projects/-Users-nick-my-project/sessions/abc123.jsonl",
    sessionId: "abc123",
    projectPath: "/Users/nick/my-project",
    mtime: new Date("2024-06-01T12:00:00.000Z"),
    ...overrides,
  };
}

function makeParsed(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    messageCount: 0,
    toolsUsed: [],
    filesModified: [],
    errorsEncountered: [],
    costUsd: 0,
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}

describe("normalizeSession", () => {
  describe("identity fields pass-through", () => {
    it("carries sessionId from meta", () => {
      const result = normalizeSession(
        makeMeta({ sessionId: "session-xyz" }),
        makeParsed()
      );
      expect(result.sessionId).toBe("session-xyz");
    });

    it("carries projectPath from meta", () => {
      const result = normalizeSession(
        makeMeta({ projectPath: "/Users/alice/projects/webapp" }),
        makeParsed()
      );
      expect(result.projectPath).toBe("/Users/alice/projects/webapp");
    });

    it("carries filePath from meta", () => {
      const result = normalizeSession(
        makeMeta({ filePath: "/home/user/.claude/sessions/def456.jsonl" }),
        makeParsed()
      );
      expect(result.filePath).toBe("/home/user/.claude/sessions/def456.jsonl");
    });

    it("carries messageCount from parsed", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ messageCount: 42 }));
      expect(result.messageCount).toBe(42);
    });

    it("carries toolsUsed array from parsed", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ toolsUsed: ["Bash", "Read", "Write"] })
      );
      expect(result.toolsUsed).toEqual(["Bash", "Read", "Write"]);
    });

    it("carries filesModified array from parsed", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ filesModified: ["/src/index.ts", "/src/utils.ts"] })
      );
      expect(result.filesModified).toEqual(["/src/index.ts", "/src/utils.ts"]);
    });

    it("carries errorsEncountered array from parsed", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ errorsEncountered: ["timeout", "rate limit"] })
      );
      expect(result.errorsEncountered).toEqual(["timeout", "rate limit"]);
    });
  });

  describe("projectName derivation", () => {
    it("uses the basename of projectPath as projectName", () => {
      const result = normalizeSession(
        makeMeta({ projectPath: "/Users/nick/projects/my-app" }),
        makeParsed()
      );
      expect(result.projectName).toBe("my-app");
    });

    it("uses a deeply nested basename correctly", () => {
      const result = normalizeSession(
        makeMeta({ projectPath: "/home/user/work/company/team/repo" }),
        makeParsed()
      );
      expect(result.projectName).toBe("repo");
    });

    it("falls back to full projectPath when basename is empty", () => {
      // path.basename("/") returns "" on most platforms
      const result = normalizeSession(
        makeMeta({ projectPath: "/" }),
        makeParsed()
      );
      expect(result.projectName).toBe("/");
    });

    it("handles a single-segment path as both basename and fallback", () => {
      const result = normalizeSession(
        makeMeta({ projectPath: "my-project" }),
        makeParsed()
      );
      expect(result.projectName).toBe("my-project");
    });
  });

  describe("startedAt resolution", () => {
    it("uses parsed.startedAt when it is set", () => {
      const parsedStart = new Date("2024-03-15T09:00:00.000Z");
      const metaMtime = new Date("2024-03-15T10:00:00.000Z");
      const result = normalizeSession(
        makeMeta({ mtime: metaMtime }),
        makeParsed({ startedAt: parsedStart })
      );
      expect(result.startedAt).toEqual(parsedStart);
    });

    it("falls back to meta.mtime when parsed.startedAt is null", () => {
      const metaMtime = new Date("2024-03-15T10:00:00.000Z");
      const result = normalizeSession(
        makeMeta({ mtime: metaMtime }),
        makeParsed({ startedAt: null })
      );
      expect(result.startedAt).toEqual(metaMtime);
    });

    it("prefers parsed.startedAt over meta.mtime even when mtime is earlier", () => {
      const parsedStart = new Date("2024-03-15T11:00:00.000Z");
      const earlyMtime = new Date("2024-03-15T08:00:00.000Z");
      const result = normalizeSession(
        makeMeta({ mtime: earlyMtime }),
        makeParsed({ startedAt: parsedStart })
      );
      expect(result.startedAt).toEqual(parsedStart);
    });
  });

  describe("endedAt resolution", () => {
    it("uses parsed.endedAt when it is set", () => {
      const parsedEnd = new Date("2024-03-15T10:30:00.000Z");
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ endedAt: parsedEnd })
      );
      expect(result.endedAt).toEqual(parsedEnd);
    });

    it("returns null when parsed.endedAt is null", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ endedAt: null }));
      expect(result.endedAt).toBeNull();
    });
  });

  describe("durationSeconds computation", () => {
    it("computes duration in whole seconds when both timestamps are present", () => {
      const start = new Date("2024-03-15T09:00:00.000Z");
      const end = new Date("2024-03-15T09:05:00.000Z"); // 5 minutes = 300 seconds
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ startedAt: start, endedAt: end })
      );
      expect(result.durationSeconds).toBe(300);
    });

    it("rounds fractional seconds to the nearest integer", () => {
      const start = new Date("2024-03-15T09:00:00.000Z");
      const end = new Date("2024-03-15T09:00:01.600Z"); // 1.6 seconds → rounds to 2
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ startedAt: start, endedAt: end })
      );
      expect(result.durationSeconds).toBe(2);
    });

    it("rounds down when fractional part is below 0.5", () => {
      const start = new Date("2024-03-15T09:00:00.000Z");
      const end = new Date("2024-03-15T09:00:01.400Z"); // 1.4 seconds → rounds to 1
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ startedAt: start, endedAt: end })
      );
      expect(result.durationSeconds).toBe(1);
    });

    it("returns null for durationSeconds when endedAt is null", () => {
      const start = new Date("2024-03-15T09:00:00.000Z");
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ startedAt: start, endedAt: null })
      );
      expect(result.durationSeconds).toBeNull();
    });

    it("uses meta.mtime as startedAt for duration when parsed.startedAt is null", () => {
      const mtime = new Date("2024-03-15T09:00:00.000Z");
      const end = new Date("2024-03-15T09:10:00.000Z"); // 10 minutes = 600 seconds
      const result = normalizeSession(
        makeMeta({ mtime }),
        makeParsed({ startedAt: null, endedAt: end })
      );
      expect(result.durationSeconds).toBe(600);
    });

    it("handles zero-duration sessions (same start and end)", () => {
      const ts = new Date("2024-03-15T09:00:00.000Z");
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ startedAt: ts, endedAt: ts })
      );
      expect(result.durationSeconds).toBe(0);
    });
  });

  describe("costUsd handling", () => {
    it("returns the cost value when it is positive", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ costUsd: 0.0042 }));
      expect(result.costUsd).toBeCloseTo(0.0042);
    });

    it("returns null when cost is zero", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ costUsd: 0 }));
      expect(result.costUsd).toBeNull();
    });

    it("returns null when cost is negative", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ costUsd: -1.5 }));
      expect(result.costUsd).toBeNull();
    });

    it("preserves larger cost values accurately", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ costUsd: 12.345 }));
      expect(result.costUsd).toBeCloseTo(12.345);
    });
  });

  describe("return type shape", () => {
    it("returns an object with all required NormalizedSession fields", () => {
      const result = normalizeSession(makeMeta(), makeParsed());
      const keys: (keyof NormalizedSession)[] = [
        "sessionId",
        "projectPath",
        "projectName",
        "filePath",
        "messageCount",
        "toolsUsed",
        "filesModified",
        "errorsEncountered",
        "costUsd",
        "startedAt",
        "endedAt",
        "durationSeconds",
      ];
      for (const key of keys) {
        expect(result).toHaveProperty(key);
      }
    });
  });

  describe("full session scenario", () => {
    it("correctly normalizes a realistic parsed session with all fields populated", () => {
      const meta = makeMeta({
        sessionId: "session-001",
        projectPath: "/Users/alice/work/backend-api",
        filePath: "/home/alice/.claude/projects/-Users-alice-work-backend-api/sessions/session-001.jsonl",
        mtime: new Date("2024-04-10T14:00:00.000Z"),
      });

      const parsed = makeParsed({
        messageCount: 12,
        toolsUsed: ["Bash", "Read", "Write", "Edit"],
        filesModified: ["/src/server.ts", "/src/routes/users.ts"],
        errorsEncountered: ["linter error"],
        costUsd: 0.0215,
        startedAt: new Date("2024-04-10T13:55:00.000Z"),
        endedAt: new Date("2024-04-10T14:25:00.000Z"),
      });

      const result = normalizeSession(meta, parsed);

      expect(result.sessionId).toBe("session-001");
      expect(result.projectPath).toBe("/Users/alice/work/backend-api");
      expect(result.projectName).toBe("backend-api");
      expect(result.filePath).toContain("session-001.jsonl");
      expect(result.messageCount).toBe(12);
      expect(result.toolsUsed).toEqual(["Bash", "Read", "Write", "Edit"]);
      expect(result.filesModified).toEqual(["/src/server.ts", "/src/routes/users.ts"]);
      expect(result.errorsEncountered).toEqual(["linter error"]);
      expect(result.costUsd).toBeCloseTo(0.0215);
      expect(result.startedAt).toEqual(new Date("2024-04-10T13:55:00.000Z"));
      expect(result.endedAt).toEqual(new Date("2024-04-10T14:25:00.000Z"));
      expect(result.durationSeconds).toBe(1800); // 30 minutes
    });

    it("correctly normalizes a session with no parsed timestamps and zero cost", () => {
      const mtime = new Date("2024-04-10T14:00:00.000Z");
      const meta = makeMeta({ mtime, projectPath: "/home/bob/scripts" });
      const parsed = makeParsed({
        messageCount: 3,
        toolsUsed: ["Bash"],
        costUsd: 0,
        startedAt: null,
        endedAt: null,
      });

      const result = normalizeSession(meta, parsed);

      expect(result.startedAt).toEqual(mtime);
      expect(result.endedAt).toBeNull();
      expect(result.durationSeconds).toBeNull();
      expect(result.costUsd).toBeNull();
      expect(result.projectName).toBe("scripts");
    });
  });
});
