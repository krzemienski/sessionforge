/**
 * Unit tests for the file watcher utility.
 *
 * Tests cover:
 * - detectSessionChanges: pure comparison logic (no I/O)
 * - shouldFirePipeline: pure debounce logic (no I/O)
 * - getSessionFingerprint: filesystem scanning (uses real temp dirs)
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  detectSessionChanges,
  shouldFirePipeline,
  getSessionFingerprint,
  type SessionFingerprint,
} from "../file-watcher";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "file-watcher-test-"));
}

async function writeFile(dir: string, name: string, content = ""): Promise<string> {
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, content);
  return filePath;
}

async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// detectSessionChanges
// ---------------------------------------------------------------------------

describe("detectSessionChanges", () => {
  describe("added files", () => {
    it("reports a file as added when it exists in curr but not in prev", () => {
      const prev: SessionFingerprint = {};
      const curr: SessionFingerprint = { "/path/to/session.jsonl": 1000 };

      const result = detectSessionChanges(prev, curr);

      expect(result.added).toEqual(["/path/to/session.jsonl"]);
      expect(result.modified).toEqual([]);
      expect(result.hasChanges).toBe(true);
    });

    it("reports multiple added files when prev is empty", () => {
      const prev: SessionFingerprint = {};
      const curr: SessionFingerprint = {
        "/path/a.jsonl": 1000,
        "/path/b.jsonl": 2000,
      };

      const result = detectSessionChanges(prev, curr);

      expect(result.added).toHaveLength(2);
      expect(result.added).toContain("/path/a.jsonl");
      expect(result.added).toContain("/path/b.jsonl");
      expect(result.hasChanges).toBe(true);
    });

    it("does not report as added when file exists in both prev and curr with same mtime", () => {
      const prev: SessionFingerprint = { "/path/session.jsonl": 1000 };
      const curr: SessionFingerprint = { "/path/session.jsonl": 1000 };

      const result = detectSessionChanges(prev, curr);

      expect(result.added).toEqual([]);
      expect(result.modified).toEqual([]);
      expect(result.hasChanges).toBe(false);
    });
  });

  describe("modified files", () => {
    it("reports a file as modified when mtime changes", () => {
      const prev: SessionFingerprint = { "/path/session.jsonl": 1000 };
      const curr: SessionFingerprint = { "/path/session.jsonl": 2000 };

      const result = detectSessionChanges(prev, curr);

      expect(result.modified).toEqual(["/path/session.jsonl"]);
      expect(result.added).toEqual([]);
      expect(result.hasChanges).toBe(true);
    });

    it("reports multiple modified files", () => {
      const prev: SessionFingerprint = {
        "/path/a.jsonl": 100,
        "/path/b.jsonl": 200,
        "/path/c.jsonl": 300,
      };
      const curr: SessionFingerprint = {
        "/path/a.jsonl": 101,
        "/path/b.jsonl": 201,
        "/path/c.jsonl": 300,
      };

      const result = detectSessionChanges(prev, curr);

      expect(result.modified).toHaveLength(2);
      expect(result.modified).toContain("/path/a.jsonl");
      expect(result.modified).toContain("/path/b.jsonl");
      expect(result.modified).not.toContain("/path/c.jsonl");
      expect(result.hasChanges).toBe(true);
    });

    it("does not report as modified when only mtime decreases (clock skew)", () => {
      // Any mtime change (increase or decrease) is a modification
      const prev: SessionFingerprint = { "/path/session.jsonl": 5000 };
      const curr: SessionFingerprint = { "/path/session.jsonl": 3000 };

      const result = detectSessionChanges(prev, curr);

      expect(result.modified).toEqual(["/path/session.jsonl"]);
    });
  });

  describe("deleted files", () => {
    it("ignores files present in prev but absent in curr", () => {
      const prev: SessionFingerprint = { "/path/deleted.jsonl": 1000 };
      const curr: SessionFingerprint = {};

      const result = detectSessionChanges(prev, curr);

      expect(result.added).toEqual([]);
      expect(result.modified).toEqual([]);
      expect(result.hasChanges).toBe(false);
    });

    it("ignores deleted files even when other files are added", () => {
      const prev: SessionFingerprint = { "/path/old.jsonl": 1000 };
      const curr: SessionFingerprint = { "/path/new.jsonl": 2000 };

      const result = detectSessionChanges(prev, curr);

      expect(result.added).toEqual(["/path/new.jsonl"]);
      expect(result.modified).toEqual([]);
    });
  });

  describe("hasChanges flag", () => {
    it("is false when both fingerprints are empty", () => {
      const result = detectSessionChanges({}, {});
      expect(result.hasChanges).toBe(false);
    });

    it("is false when both fingerprints are identical", () => {
      const fp: SessionFingerprint = {
        "/path/a.jsonl": 1000,
        "/path/b.jsonl": 2000,
      };
      const result = detectSessionChanges(fp, { ...fp });
      expect(result.hasChanges).toBe(false);
    });

    it("is true when there is at least one added file", () => {
      const result = detectSessionChanges({}, { "/path/new.jsonl": 1000 });
      expect(result.hasChanges).toBe(true);
    });

    it("is true when there is at least one modified file", () => {
      const result = detectSessionChanges(
        { "/path/a.jsonl": 1000 },
        { "/path/a.jsonl": 9999 }
      );
      expect(result.hasChanges).toBe(true);
    });

    it("is true when both added and modified files exist", () => {
      const result = detectSessionChanges(
        { "/path/existing.jsonl": 1000 },
        { "/path/existing.jsonl": 2000, "/path/new.jsonl": 3000 }
      );
      expect(result.hasChanges).toBe(true);
      expect(result.added).toHaveLength(1);
      expect(result.modified).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// shouldFirePipeline
// ---------------------------------------------------------------------------

describe("shouldFirePipeline", () => {
  describe("when lastFileEventAt is null", () => {
    it("returns false regardless of debounce minutes", () => {
      expect(shouldFirePipeline(null, 0)).toBe(false);
      expect(shouldFirePipeline(null, 5)).toBe(false);
      expect(shouldFirePipeline(null, 60)).toBe(false);
    });
  });

  describe("when debounce window has elapsed", () => {
    it("returns true when elapsed time exactly equals debounce window", () => {
      const debounceMinutes = 5;
      const debounceMs = debounceMinutes * 60 * 1000;
      const lastFileEventAt = new Date(Date.now() - debounceMs);

      expect(shouldFirePipeline(lastFileEventAt, debounceMinutes)).toBe(true);
    });

    it("returns true when elapsed time exceeds the debounce window", () => {
      const debounceMinutes = 5;
      const lastFileEventAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      expect(shouldFirePipeline(lastFileEventAt, debounceMinutes)).toBe(true);
    });

    it("returns true for debounceMinutes = 0 with any past timestamp", () => {
      const lastFileEventAt = new Date(Date.now() - 1);
      expect(shouldFirePipeline(lastFileEventAt, 0)).toBe(true);
    });

    it("returns true with a very old timestamp", () => {
      const lastFileEventAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      expect(shouldFirePipeline(lastFileEventAt, 30)).toBe(true);
    });
  });

  describe("when debounce window has NOT elapsed", () => {
    it("returns false when event just happened", () => {
      const lastFileEventAt = new Date(); // now
      expect(shouldFirePipeline(lastFileEventAt, 5)).toBe(false);
    });

    it("returns false when elapsed time is less than the debounce window", () => {
      const debounceMinutes = 10;
      const lastFileEventAt = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

      expect(shouldFirePipeline(lastFileEventAt, debounceMinutes)).toBe(false);
    });

    it("returns false when elapsed time is slightly less than debounce window", () => {
      const debounceMinutes = 5;
      const debounceMs = debounceMinutes * 60 * 1000;
      const lastFileEventAt = new Date(Date.now() - debounceMs + 1000); // 1 second short

      expect(shouldFirePipeline(lastFileEventAt, debounceMinutes)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// getSessionFingerprint
// ---------------------------------------------------------------------------

describe("getSessionFingerprint", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempDir();
  });

  afterEach(async () => {
    await removeDir(tmpDir);
  });

  describe("when the base directory does not exist", () => {
    it("returns an empty fingerprint for a nonexistent base path", async () => {
      const result = await getSessionFingerprint(path.join(tmpDir, "nonexistent"));
      expect(result).toEqual({});
    });
  });

  describe("global sessions directory", () => {
    it("returns an empty fingerprint when sessions dir does not exist", async () => {
      const result = await getSessionFingerprint(tmpDir);
      expect(result).toEqual({});
    });

    it("includes .jsonl files from the global sessions directory", async () => {
      const sessionsDir = path.join(tmpDir, "sessions");
      await fs.mkdir(sessionsDir, { recursive: true });
      const filePath = await writeFile(sessionsDir, "session1.jsonl", "data");

      const result = await getSessionFingerprint(tmpDir);

      expect(Object.keys(result)).toContain(filePath);
      expect(typeof result[filePath]).toBe("number");
    });

    it("excludes non-.jsonl files from the global sessions directory", async () => {
      const sessionsDir = path.join(tmpDir, "sessions");
      await fs.mkdir(sessionsDir, { recursive: true });
      await writeFile(sessionsDir, "session.txt", "data");
      await writeFile(sessionsDir, "session.json", "data");
      await writeFile(sessionsDir, "session.jsonl", "data");

      const result = await getSessionFingerprint(tmpDir);

      const keys = Object.keys(result);
      expect(keys.every((k) => k.endsWith(".jsonl"))).toBe(true);
      expect(keys).toHaveLength(1);
    });

    it("includes multiple .jsonl files from the global sessions directory", async () => {
      const sessionsDir = path.join(tmpDir, "sessions");
      await fs.mkdir(sessionsDir, { recursive: true });
      await writeFile(sessionsDir, "session1.jsonl");
      await writeFile(sessionsDir, "session2.jsonl");
      await writeFile(sessionsDir, "session3.jsonl");

      const result = await getSessionFingerprint(tmpDir);

      expect(Object.keys(result)).toHaveLength(3);
    });

    it("records the mtime as a number in milliseconds", async () => {
      const sessionsDir = path.join(tmpDir, "sessions");
      await fs.mkdir(sessionsDir, { recursive: true });
      const filePath = await writeFile(sessionsDir, "session.jsonl", "content");

      const stat = await fs.stat(filePath);
      const result = await getSessionFingerprint(tmpDir);

      expect(result[filePath]).toBe(stat.mtimeMs);
    });
  });

  describe("per-project sessions directories", () => {
    it("returns empty fingerprint when projects dir does not exist", async () => {
      const sessionsDir = path.join(tmpDir, "sessions");
      await fs.mkdir(sessionsDir, { recursive: true });

      // No projects dir — only sessions dir
      const result = await getSessionFingerprint(tmpDir);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it("includes .jsonl files from a project sessions directory", async () => {
      const projectDir = path.join(tmpDir, "projects", "my-project", "sessions");
      await fs.mkdir(projectDir, { recursive: true });
      const filePath = await writeFile(projectDir, "session.jsonl", "data");

      const result = await getSessionFingerprint(tmpDir);

      expect(Object.keys(result)).toContain(filePath);
    });

    it("includes files from multiple project directories", async () => {
      const projectA = path.join(tmpDir, "projects", "project-a", "sessions");
      const projectB = path.join(tmpDir, "projects", "project-b", "sessions");
      await fs.mkdir(projectA, { recursive: true });
      await fs.mkdir(projectB, { recursive: true });
      await writeFile(projectA, "a.jsonl");
      await writeFile(projectB, "b.jsonl");

      const result = await getSessionFingerprint(tmpDir);

      expect(Object.keys(result)).toHaveLength(2);
    });

    it("excludes non-directory entries in the projects directory", async () => {
      const projectsDir = path.join(tmpDir, "projects");
      await fs.mkdir(projectsDir, { recursive: true });
      // Write a file directly in projects/ — should not be treated as a project
      await writeFile(projectsDir, "not-a-dir.jsonl", "data");

      const result = await getSessionFingerprint(tmpDir);

      expect(result).toEqual({});
    });

    it("skips project directories that have no sessions subdirectory", async () => {
      const projectDir = path.join(tmpDir, "projects", "no-sessions-dir");
      await fs.mkdir(projectDir, { recursive: true });
      // No "sessions" subdirectory inside project

      const result = await getSessionFingerprint(tmpDir);

      expect(result).toEqual({});
    });
  });

  describe("combined global and per-project sessions", () => {
    it("merges files from both global and project session directories", async () => {
      const globalSessionsDir = path.join(tmpDir, "sessions");
      const projectSessionsDir = path.join(
        tmpDir,
        "projects",
        "my-project",
        "sessions"
      );
      await fs.mkdir(globalSessionsDir, { recursive: true });
      await fs.mkdir(projectSessionsDir, { recursive: true });

      const globalFile = await writeFile(globalSessionsDir, "global.jsonl");
      const projectFile = await writeFile(projectSessionsDir, "project.jsonl");

      const result = await getSessionFingerprint(tmpDir);

      expect(Object.keys(result)).toContain(globalFile);
      expect(Object.keys(result)).toContain(projectFile);
      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe("tilde expansion", () => {
    it("resolves a tilde-prefixed path to the home directory without throwing", async () => {
      // We pass "~/.nonexistent-sessionforge-test" — should not throw and return {}
      const result = await getSessionFingerprint("~/.nonexistent-sessionforge-test-dir");
      expect(result).toEqual({});
    });
  });
});
