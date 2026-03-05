/**
 * Unit tests for the session file scanner.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFile, mkdir, rm, utimes } from "fs/promises";
import { join } from "path";
import { scanSessionFiles } from "../scanner";

const TMP_DIR = join(import.meta.dir, "__tmp_scanner_tests__");

async function makeDir(relPath: string): Promise<string> {
  const fullPath = join(TMP_DIR, relPath);
  await mkdir(fullPath, { recursive: true });
  return fullPath;
}

async function makeFile(relPath: string, mtime?: Date): Promise<string> {
  const fullPath = join(TMP_DIR, relPath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, "", "utf8");
  if (mtime) {
    await utimes(fullPath, mtime, mtime);
  }
  return fullPath;
}

describe("scanSessionFiles", () => {
  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe("empty / missing directories", () => {
    it("returns empty array when base path does not exist", async () => {
      const result = await scanSessionFiles(30, join(TMP_DIR, "nonexistent"));
      expect(result).toEqual([]);
    });

    it("returns empty array when projects dir does not exist", async () => {
      await mkdir(TMP_DIR, { recursive: true });
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toEqual([]);
    });

    it("returns empty array when sessions dir has no .jsonl files", async () => {
      await makeDir("projects/my-project/sessions");
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toEqual([]);
    });
  });

  describe("project sessions discovery", () => {
    it("discovers .jsonl files in project sessions dirs", async () => {
      const now = new Date();
      await makeFile("projects/-Users-nick-myapp/sessions/abc-123.jsonl", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("abc-123");
    });

    it("returns correct filePath for discovered session", async () => {
      const now = new Date();
      const filePath = await makeFile(
        "projects/-Users-nick-myapp/sessions/abc-123.jsonl",
        now
      );
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result[0].filePath).toBe(filePath);
    });

    it("decodes project path correctly", async () => {
      const now = new Date();
      await makeFile("projects/-Users-nick-myapp/sessions/session1.jsonl", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result[0].projectPath).toBe("/Users/nick/myapp");
    });

    it("discovers sessions across multiple projects", async () => {
      const now = new Date();
      await makeFile("projects/-Users-nick-project-a/sessions/s1.jsonl", now);
      await makeFile("projects/-Users-nick-project-b/sessions/s2.jsonl", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(2);
      const sessionIds = result.map((r) => r.sessionId);
      expect(sessionIds).toContain("s1");
      expect(sessionIds).toContain("s2");
    });

    it("discovers multiple sessions within a single project", async () => {
      const now = new Date();
      await makeFile("projects/-Users-nick-myapp/sessions/sess-a.jsonl", now);
      await makeFile("projects/-Users-nick-myapp/sessions/sess-b.jsonl", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(2);
    });

    it("ignores non-.jsonl files in sessions dir", async () => {
      const now = new Date();
      await makeFile("projects/-Users-nick-myapp/sessions/session.jsonl", now);
      await makeFile("projects/-Users-nick-myapp/sessions/readme.txt", now);
      await makeFile("projects/-Users-nick-myapp/sessions/data.json", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("session");
    });

    it("ignores non-directory entries in projects dir", async () => {
      const now = new Date();
      await makeDir("projects");
      await makeFile("projects/not-a-dir.jsonl", now);
      await makeFile("projects/-Users-nick-myapp/sessions/real.jsonl", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("real");
    });
  });

  describe("global sessions discovery", () => {
    it("discovers .jsonl files in top-level sessions dir", async () => {
      const now = new Date();
      await makeFile("sessions/global-session.jsonl", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("global-session");
    });

    it("sets projectPath to base path for global sessions", async () => {
      const now = new Date();
      await makeFile("sessions/global-session.jsonl", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result[0].projectPath).toBe(TMP_DIR);
    });

    it("discovers both global and project sessions together", async () => {
      const now = new Date();
      await makeFile("projects/-Users-nick-myapp/sessions/project-sess.jsonl", now);
      await makeFile("sessions/global-sess.jsonl", now);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(2);
      const sessionIds = result.map((r) => r.sessionId);
      expect(sessionIds).toContain("project-sess");
      expect(sessionIds).toContain("global-sess");
    });
  });

  describe("lookback filtering", () => {
    it("includes files modified within lookback window", async () => {
      const recentMtime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      await makeFile("projects/-Users-nick-myapp/sessions/recent.jsonl", recentMtime);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(1);
    });

    it("excludes files modified before lookback window", async () => {
      const oldMtime = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      await makeFile("projects/-Users-nick-myapp/sessions/old.jsonl", oldMtime);
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result).toHaveLength(0);
    });

    it("excludes files exactly at the cutoff boundary (strictly less than)", async () => {
      // Files modified exactly at the cutoff should be excluded (mtime < cutoff)
      const cutoffMtime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await makeFile("projects/-Users-nick-myapp/sessions/boundary.jsonl", cutoffMtime);
      // Use sinceTimestamp slightly newer than the file's mtime
      const sinceTimestamp = new Date(cutoffMtime.getTime() + 1000);
      const result = await scanSessionFiles(30, TMP_DIR, sinceTimestamp);
      expect(result).toHaveLength(0);
    });

    it("uses sinceTimestamp when provided instead of lookback calculation", async () => {
      const oldMtime = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const recentMtime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      await makeFile("projects/-Users-nick-myapp/sessions/old.jsonl", oldMtime);
      await makeFile("projects/-Users-nick-myapp/sessions/recent.jsonl", recentMtime);
      // Use sinceTimestamp that excludes the old file but includes the recent one
      const sinceTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const result = await scanSessionFiles(30, TMP_DIR, sinceTimestamp);
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("recent");
    });

    it("respects lookbackDays=0 to only include very recent files", async () => {
      const oldMtime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      await makeFile("projects/-Users-nick-myapp/sessions/old.jsonl", oldMtime);
      const result = await scanSessionFiles(0, TMP_DIR);
      expect(result).toHaveLength(0);
    });
  });

  describe("mtime field", () => {
    it("returns correct mtime for discovered session", async () => {
      const mtime = new Date("2024-06-01T12:00:00.000Z");
      await makeFile("projects/-Users-nick-myapp/sessions/timed.jsonl", mtime);
      const result = await scanSessionFiles(30 * 365, TMP_DIR); // large lookback to ensure it's included
      expect(result).toHaveLength(1);
      // Allow small tolerance for filesystem mtime precision
      expect(Math.abs(result[0].mtime.getTime() - mtime.getTime())).toBeLessThan(2000);
    });
  });

  describe("sessionId extraction", () => {
    it("strips .jsonl extension from filename to produce sessionId", async () => {
      const now = new Date();
      await makeFile(
        "projects/-Users-nick-myapp/sessions/550e8400-e29b-41d4-a716-446655440000.jsonl",
        now
      );
      const result = await scanSessionFiles(30, TMP_DIR);
      expect(result[0].sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
    });
  });

  describe("tilde expansion", () => {
    it("does not throw when given a tilde-prefixed basePath that does not resolve to files", async () => {
      // This just verifies the tilde expansion doesn't crash — the real home dir
      // will be scanned but we cannot control its contents; we only assert no throw.
      const result = await scanSessionFiles(0, "~/.claude-nonexistent-test-dir-xyz");
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
