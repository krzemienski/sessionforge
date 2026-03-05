/**
 * Unit tests for the session normalizer (data transformation).
 */

import { describe, it, expect } from "bun:test";
import { normalizeSession } from "../normalizer";
import type { SessionFileMeta } from "../scanner";
import type { ParsedSession } from "../parser";

function makeMeta(overrides: Partial<SessionFileMeta> = {}): SessionFileMeta {
  return {
    sessionId: "test-session-id",
    projectPath: "/Users/nick/my-project",
    filePath: "/Users/nick/.claude/projects/-Users-nick-my-project/sessions/test-session-id.jsonl",
    mtime: new Date("2024-06-01T10:00:00.000Z"),
    ...overrides,
  };
}

function makeParsed(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    messageCount: 10,
    toolsUsed: ["Read", "Write"],
    filesModified: ["/src/index.ts"],
    errorsEncountered: [],
    costUsd: 0.05,
    startedAt: new Date("2024-06-01T09:00:00.000Z"),
    endedAt: new Date("2024-06-01T09:30:00.000Z"),
    ...overrides,
  };
}

describe("normalizeSession", () => {
  describe("basic field mapping", () => {
    it("maps sessionId from meta", () => {
      const result = normalizeSession(makeMeta(), makeParsed());
      expect(result.sessionId).toBe("test-session-id");
    });

    it("maps projectPath from meta", () => {
      const result = normalizeSession(makeMeta(), makeParsed());
      expect(result.projectPath).toBe("/Users/nick/my-project");
    });

    it("maps filePath from meta", () => {
      const meta = makeMeta();
      const result = normalizeSession(meta, makeParsed());
      expect(result.filePath).toBe(meta.filePath);
    });

    it("maps messageCount from parsed", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ messageCount: 42 }));
      expect(result.messageCount).toBe(42);
    });

    it("maps toolsUsed from parsed", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ toolsUsed: ["Read", "Edit", "Bash"] })
      );
      expect(result.toolsUsed).toEqual(["Read", "Edit", "Bash"]);
    });

    it("maps filesModified from parsed", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ filesModified: ["/src/a.ts", "/src/b.ts"] })
      );
      expect(result.filesModified).toEqual(["/src/a.ts", "/src/b.ts"]);
    });

    it("maps errorsEncountered from parsed", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ errorsEncountered: ["Something went wrong"] })
      );
      expect(result.errorsEncountered).toEqual(["Something went wrong"]);
    });
  });

  describe("projectName derivation", () => {
    it("derives projectName as the last segment of projectPath", () => {
      const result = normalizeSession(
        makeMeta({ projectPath: "/Users/nick/my-project" }),
        makeParsed()
      );
      expect(result.projectName).toBe("my-project");
    });

    it("derives projectName from deeply nested path", () => {
      const result = normalizeSession(
        makeMeta({ projectPath: "/home/user/projects/awesome-app" }),
        makeParsed()
      );
      expect(result.projectName).toBe("awesome-app");
    });

    it("falls back to full path when basename is empty (root path edge case)", () => {
      const result = normalizeSession(
        makeMeta({ projectPath: "/" }),
        makeParsed()
      );
      // path.basename("/") returns "" so it falls back to the full path
      expect(result.projectName).toBe("/");
    });

    it("handles single-segment project path", () => {
      const result = normalizeSession(
        makeMeta({ projectPath: "myapp" }),
        makeParsed()
      );
      expect(result.projectName).toBe("myapp");
    });
  });

  describe("startedAt fallback", () => {
    it("uses parsed startedAt when available", () => {
      const parsedStart = new Date("2024-06-01T09:00:00.000Z");
      const result = normalizeSession(
        makeMeta({ mtime: new Date("2024-06-01T10:00:00.000Z") }),
        makeParsed({ startedAt: parsedStart })
      );
      expect(result.startedAt).toEqual(parsedStart);
    });

    it("falls back to meta.mtime when parsed startedAt is null", () => {
      const mtime = new Date("2024-06-01T10:00:00.000Z");
      const result = normalizeSession(
        makeMeta({ mtime }),
        makeParsed({ startedAt: null })
      );
      expect(result.startedAt).toEqual(mtime);
    });
  });

  describe("endedAt handling", () => {
    it("uses parsed endedAt when available", () => {
      const parsedEnd = new Date("2024-06-01T09:30:00.000Z");
      const result = normalizeSession(makeMeta(), makeParsed({ endedAt: parsedEnd }));
      expect(result.endedAt).toEqual(parsedEnd);
    });

    it("sets endedAt to null when parsed endedAt is null", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ endedAt: null }));
      expect(result.endedAt).toBeNull();
    });
  });

  describe("durationSeconds computation", () => {
    it("computes durationSeconds from startedAt and endedAt", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({
          startedAt: new Date("2024-06-01T09:00:00.000Z"),
          endedAt: new Date("2024-06-01T09:30:00.000Z"),
        })
      );
      expect(result.durationSeconds).toBe(1800);
    });

    it("rounds durationSeconds to nearest integer", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({
          startedAt: new Date("2024-06-01T09:00:00.000Z"),
          endedAt: new Date("2024-06-01T09:00:01.500Z"),
        })
      );
      expect(result.durationSeconds).toBe(2);
    });

    it("sets durationSeconds to null when endedAt is null", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ endedAt: null }));
      expect(result.durationSeconds).toBeNull();
    });

    it("computes durationSeconds using fallback mtime as startedAt", () => {
      const mtime = new Date("2024-06-01T08:00:00.000Z");
      const endedAt = new Date("2024-06-01T08:10:00.000Z");
      const result = normalizeSession(
        makeMeta({ mtime }),
        makeParsed({ startedAt: null, endedAt })
      );
      expect(result.durationSeconds).toBe(600);
    });

    it("sets durationSeconds to null when both startedAt and endedAt are null", () => {
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ startedAt: null, endedAt: null })
      );
      // startedAt falls back to mtime, but endedAt is null — so null
      expect(result.durationSeconds).toBeNull();
    });

    it("computes zero durationSeconds when start and end are equal", () => {
      const ts = new Date("2024-06-01T09:00:00.000Z");
      const result = normalizeSession(
        makeMeta(),
        makeParsed({ startedAt: ts, endedAt: ts })
      );
      expect(result.durationSeconds).toBe(0);
    });
  });

  describe("costUsd normalization", () => {
    it("passes through positive costUsd", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ costUsd: 0.123 }));
      expect(result.costUsd).toBe(0.123);
    });

    it("sets costUsd to null when parsed cost is zero", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ costUsd: 0 }));
      expect(result.costUsd).toBeNull();
    });

    it("sets costUsd to null when parsed cost is negative", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ costUsd: -1 }));
      expect(result.costUsd).toBeNull();
    });

    it("preserves small positive costUsd values", () => {
      const result = normalizeSession(makeMeta(), makeParsed({ costUsd: 0.0001 }));
      expect(result.costUsd).toBe(0.0001);
    });
  });

  describe("full integration", () => {
    it("returns a fully normalized session with all expected fields", () => {
      const meta = makeMeta({
        sessionId: "abc-123",
        projectPath: "/Users/nick/sessionforge",
        filePath: "/home/.claude/projects/abc/sessions/abc-123.jsonl",
        mtime: new Date("2024-06-01T08:00:00.000Z"),
      });
      const parsed = makeParsed({
        messageCount: 25,
        toolsUsed: ["Read", "Write", "Bash"],
        filesModified: ["/src/index.ts", "/src/utils.ts"],
        errorsEncountered: ["Error: file not found"],
        costUsd: 0.42,
        startedAt: new Date("2024-06-01T09:00:00.000Z"),
        endedAt: new Date("2024-06-01T10:00:00.000Z"),
      });

      const result = normalizeSession(meta, parsed);

      expect(result).toEqual({
        sessionId: "abc-123",
        projectPath: "/Users/nick/sessionforge",
        projectName: "sessionforge",
        filePath: "/home/.claude/projects/abc/sessions/abc-123.jsonl",
        messageCount: 25,
        toolsUsed: ["Read", "Write", "Bash"],
        filesModified: ["/src/index.ts", "/src/utils.ts"],
        errorsEncountered: ["Error: file not found"],
        costUsd: 0.42,
        startedAt: new Date("2024-06-01T09:00:00.000Z"),
        endedAt: new Date("2024-06-01T10:00:00.000Z"),
        durationSeconds: 3600,
      });
    });

    it("handles a session with no timestamps and zero cost", () => {
      const mtime = new Date("2024-06-01T08:00:00.000Z");
      const meta = makeMeta({ mtime });
      const parsed = makeParsed({
        startedAt: null,
        endedAt: null,
        costUsd: 0,
      });

      const result = normalizeSession(meta, parsed);

      expect(result.startedAt).toEqual(mtime);
      expect(result.endedAt).toBeNull();
      expect(result.durationSeconds).toBeNull();
      expect(result.costUsd).toBeNull();
    });
  });
});
