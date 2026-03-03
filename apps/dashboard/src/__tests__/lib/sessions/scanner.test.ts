import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";
import path from "path";

vi.mock("fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

import fs from "fs/promises";
import { scanSessionFiles, type SessionFileMeta } from "@/lib/sessions/scanner";

// Dirent-like mock helpers (scanner uses isDirectory() / isFile())
function makeDirEntry(name: string) {
  return {
    name,
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false,
  };
}

function makeFileEntry(name: string) {
  return {
    name,
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => false,
  };
}

// Minimal Stats-like mock for fs.stat results
function makeStat(mtime: Date) {
  return { mtime } as unknown as Awaited<ReturnType<typeof fs.stat>>;
}

const TEST_BASE = "/test-home/.claude";
const PROJECTS_DIR = path.join(TEST_BASE, "projects");
const GLOBAL_SESSIONS_DIR = path.join(TEST_BASE, "sessions");

describe("scanSessionFiles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("basePath resolution", () => {
    it("resolves ~ prefix to os.homedir()", async () => {
      const realHome = os.homedir();
      vi.mocked(fs.readdir as any).mockRejectedValue(new Error("ENOENT"));

      await scanSessionFiles(30, "~/.claude");

      const calledPaths = vi.mocked(fs.readdir as any).mock.calls.map(
        (c: unknown[]) => c[0] as string
      );
      expect(calledPaths).toContain(path.join(realHome, ".claude", "projects"));
    });

    it("uses basePath as-is when it does not start with ~", async () => {
      vi.mocked(fs.readdir as any).mockRejectedValue(new Error("ENOENT"));

      const result = await scanSessionFiles(30, "/absolute/base/.claude");

      expect(result).toEqual([]);
      const calledPaths = vi.mocked(fs.readdir as any).mock.calls.map(
        (c: unknown[]) => c[0] as string
      );
      expect(calledPaths[0]).toBe("/absolute/base/.claude/projects");
    });
  });

  describe("missing or empty directories", () => {
    it("returns [] when the projects directory does not exist", async () => {
      vi.mocked(fs.readdir as any).mockRejectedValue(
        Object.assign(new Error("ENOENT: no such file or directory"), {
          code: "ENOENT",
        })
      );

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toEqual([]);
    });

    it("returns [] when projects directory is empty", async () => {
      vi.mocked(fs.readdir as any).mockResolvedValue([]);

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toEqual([]);
    });

    it("returns [] when a project's sessions directory is missing", async () => {
      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      });

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toEqual([]);
    });
  });

  describe("project session scanning", () => {
    it("finds JSONL files under projects/*/sessions/", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-myproject")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-myproject", "sessions")) {
          return [makeFileEntry("abc123.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("abc123");
      expect(result[0].filePath).toBe(
        path.join(PROJECTS_DIR, "-Users-nick-myproject", "sessions", "abc123.jsonl")
      );
    });

    it("decodes encoded project directory names to project paths", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-myproject")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-myproject", "sessions")) {
          return [makeFileEntry("sess.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result[0].projectPath).toBe("/Users/nick/myproject");
    });

    it("decodes a deeper encoded path with multiple segments", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const encoded = "-home-alice-work-repo";

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry(encoded)];
        }
        if (dir === path.join(PROJECTS_DIR, encoded, "sessions")) {
          return [makeFileEntry("s.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result[0].projectPath).toBe("/home/alice/work/repo");
    });

    it("skips non-directory entries in the projects directory", async () => {
      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeFileEntry("not-a-project.txt"), makeFileEntry("config.json")];
        }
        return [];
      });

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toEqual([]);
    });

    it("handles multiple project directories and collects files from each", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [
            makeDirEntry("-Users-nick-project-a"),
            makeDirEntry("-Users-nick-project-b"),
          ];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project-a", "sessions")) {
          return [makeFileEntry("sess-1.jsonl")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project-b", "sessions")) {
          return [makeFileEntry("sess-2.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.sessionId).sort();
      expect(ids).toEqual(["sess-1", "sess-2"]);
    });

    it("ignores non-JSONL files in a project sessions directory", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [
            makeFileEntry("session.jsonl"),
            makeFileEntry("readme.md"),
            makeFileEntry("backup.json"),
          ];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("session");
    });
  });

  describe("global session scanning", () => {
    it("finds JSONL files under the global sessions/ directory", async () => {
      const mtime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) return [];
        if (dir === GLOBAL_SESSIONS_DIR) {
          return [makeFileEntry("global-sess.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("global-sess");
      expect(result[0].filePath).toBe(
        path.join(GLOBAL_SESSIONS_DIR, "global-sess.jsonl")
      );
    });

    it("sets projectPath to resolvedBase for global session files", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) return [];
        if (dir === GLOBAL_SESSIONS_DIR) {
          return [makeFileEntry("g.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result[0].projectPath).toBe(TEST_BASE);
    });
  });

  describe("lookback filtering", () => {
    it("excludes files with mtime older than the lookback window", async () => {
      const oldMtime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [makeFileEntry("old.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(oldMtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(0);
    });

    it("includes files with mtime within the lookback window", async () => {
      const recentMtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [makeFileEntry("recent.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(recentMtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(1);
    });

    it("respects a custom lookbackDays value", async () => {
      // File is 5 days old – outside a 3-day window, inside a 7-day window
      const mtime5DaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [makeFileEntry("session.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime5DaysAgo));

      const result3 = await scanSessionFiles(3, TEST_BASE);
      expect(result3).toHaveLength(0);

      const result7 = await scanSessionFiles(7, TEST_BASE);
      expect(result7).toHaveLength(1);
    });

    it("applies lookback filter to global session files", async () => {
      const oldMtime = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) return [];
        if (dir === GLOBAL_SESSIONS_DIR) {
          return [makeFileEntry("old-global.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(oldMtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("skips project session files where fs.stat throws", async () => {
      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [makeFileEntry("session.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockRejectedValue(
        Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" })
      );

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toEqual([]);
    });

    it("skips global session files where fs.stat throws", async () => {
      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) return [];
        if (dir === GLOBAL_SESSIONS_DIR) {
          return [makeFileEntry("session.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockRejectedValue(
        Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" })
      );

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toEqual([]);
    });

    it("continues processing other projects when one project's sessions dir is unreadable", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [
            makeDirEntry("-Users-nick-project-a"),
            makeDirEntry("-Users-nick-project-b"),
          ];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project-a", "sessions")) {
          throw Object.assign(new Error("EACCES"), { code: "EACCES" });
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project-b", "sessions")) {
          return [makeFileEntry("sess.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("sess");
    });
  });

  describe("SessionFileMeta shape", () => {
    it("returns objects with all required SessionFileMeta fields", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [makeFileEntry("abc123.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);
      const entry = result[0];

      const keys: (keyof SessionFileMeta)[] = [
        "filePath",
        "sessionId",
        "projectPath",
        "mtime",
      ];
      for (const key of keys) {
        expect(entry).toHaveProperty(key);
      }
    });

    it("derives sessionId as the filename without the .jsonl extension", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [makeFileEntry("my-session-id.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result[0].sessionId).toBe("my-session-id");
    });

    it("uses the stat mtime for the mtime field", async () => {
      // Use a recent date so it passes the 30-day lookback filter
      const specificMtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [makeFileEntry("sess.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(specificMtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result[0].mtime).toEqual(specificMtime);
    });
  });

  describe("combined project and global sessions", () => {
    it("returns results from both project sessions and global sessions", async () => {
      const mtime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [makeDirEntry("-Users-nick-project")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project", "sessions")) {
          return [makeFileEntry("project-sess.jsonl")];
        }
        if (dir === GLOBAL_SESSIONS_DIR) {
          return [makeFileEntry("global-sess.jsonl")];
        }
        return [];
      });
      vi.mocked(fs.stat as any).mockResolvedValue(makeStat(mtime));

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.sessionId).sort();
      expect(ids).toEqual(["global-sess", "project-sess"]);
    });

    it("mixes files from multiple projects and global sessions correctly", async () => {
      const recentMtime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oldMtime = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

      vi.mocked(fs.readdir as any).mockImplementation(async (dir: string) => {
        if (dir === PROJECTS_DIR) {
          return [
            makeDirEntry("-Users-nick-project-a"),
            makeDirEntry("-Users-nick-project-b"),
          ];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project-a", "sessions")) {
          return [makeFileEntry("sess-a.jsonl")];
        }
        if (dir === path.join(PROJECTS_DIR, "-Users-nick-project-b", "sessions")) {
          return [makeFileEntry("sess-b.jsonl")];
        }
        if (dir === GLOBAL_SESSIONS_DIR) {
          return [makeFileEntry("g-recent.jsonl"), makeFileEntry("g-old.jsonl")];
        }
        return [];
      });

      vi.mocked(fs.stat as any).mockImplementation(
        async (filePath: string) => {
          if (filePath.includes("g-old")) return makeStat(oldMtime);
          return makeStat(recentMtime);
        }
      );

      const result = await scanSessionFiles(30, TEST_BASE);

      expect(result).toHaveLength(3);
      const ids = result.map((r) => r.sessionId).sort();
      expect(ids).toEqual(["g-recent", "sess-a", "sess-b"]);
    });
  });
});
