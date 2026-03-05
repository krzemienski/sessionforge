/**
 * Integration tests for the session scan → parse pipeline.
 *
 * These tests exercise the full pipeline from discovering JSONL files on disk
 * (scanSessionFiles) through parsing their contents (parseSessionFile). They
 * validate that the two modules work correctly together with real filesystem
 * operations and realistic session data.
 */

import { describe, it, expect, afterEach } from "bun:test";
import { writeFile, mkdir, rm, utimes } from "fs/promises";
import { join } from "path";
import { scanSessionFiles, type SessionFileMeta } from "../../src/lib/sessions/scanner";
import { parseSessionFile, type ParsedSession } from "../../src/lib/sessions/parser";

const TMP_DIR = join(import.meta.dir, "__tmp_session_scan_integration__");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeDir(relPath: string): Promise<string> {
  const fullPath = join(TMP_DIR, relPath);
  await mkdir(fullPath, { recursive: true });
  return fullPath;
}

async function makeSessionFile(
  relPath: string,
  content: string,
  mtime?: Date
): Promise<string> {
  const fullPath = join(TMP_DIR, relPath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, content, "utf8");
  if (mtime) {
    await utimes(fullPath, mtime, mtime);
  }
  return fullPath;
}

function jsonlLines(...objects: Record<string, unknown>[]): string {
  return objects.map((o) => JSON.stringify(o)).join("\n");
}

function realisticSession(overrides?: {
  toolsUsed?: string[];
  filesModified?: string[];
  costUsd?: number;
  messageCount?: number;
}): string {
  const { toolsUsed = ["Read", "Write"], filesModified = ["/project/src/app.ts"], costUsd = 0.05, messageCount = 4 } =
    overrides ?? {};

  const lines: Record<string, unknown>[] = [
    { type: "human", timestamp: "2024-06-01T10:00:00Z" },
    {
      type: "assistant",
      timestamp: "2024-06-01T10:00:10Z",
      message: {
        content: [
          { type: "text", text: "Let me read the file." },
          ...toolsUsed.map((name) => ({
            type: "tool_use",
            name,
            input: filesModified.length > 0 && (name === "Write" || name === "Edit")
              ? { file_path: filesModified[0] }
              : {},
          })),
        ],
      },
    },
    { type: "human", timestamp: "2024-06-01T10:01:00Z" },
    {
      type: "assistant",
      timestamp: "2024-06-01T10:01:30Z",
      message: { content: [{ type: "text", text: "Done." }] },
    },
    { type: "summary", costUSD: costUsd },
  ];

  return jsonlLines(...lines);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("session scan → parse integration pipeline", () => {
  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Basic pipeline: scan discovers, parse reads
  // -------------------------------------------------------------------------

  describe("basic scan and parse pipeline", () => {
    it("scans a project session file and parses it successfully", async () => {
      const content = realisticSession();
      await makeSessionFile(
        "projects/-Users-nick-myapp/sessions/session-001.jsonl",
        content,
        new Date()
      );

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(1);

      const parsed = await parseSessionFile(metas[0].filePath);
      expect(parsed.messageCount).toBe(4);
      expect(parsed.costUsd).toBeCloseTo(0.05);
      expect(parsed.startedAt).not.toBeNull();
      expect(parsed.endedAt).not.toBeNull();
    });

    it("connects scanned filePath to the correct parsed content", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-01-01T09:00:00Z" },
        {
          type: "assistant",
          timestamp: "2024-01-01T09:00:05Z",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: { command: "ls" } },
            ],
          },
        },
        { type: "summary", costUSD: 0.01 }
      );

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/abc-123.jsonl",
        content,
        new Date()
      );

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(1);
      expect(metas[0].sessionId).toBe("abc-123");

      const parsed = await parseSessionFile(metas[0].filePath);
      expect(parsed.messageCount).toBe(2);
      expect(parsed.toolsUsed).toContain("Bash");
      expect(parsed.costUsd).toBeCloseTo(0.01);
    });

    it("scans a global session file and parses it successfully", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-03-01T08:00:00Z" },
        {
          type: "assistant",
          timestamp: "2024-03-01T08:00:15Z",
          message: {
            content: [
              { type: "tool_use", name: "Write", input: { file_path: "/tmp/out.txt" } },
            ],
          },
        },
        { type: "summary", costUSD: 0.02 }
      );

      await makeSessionFile("sessions/global-abc.jsonl", content, new Date());

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(1);
      expect(metas[0].sessionId).toBe("global-abc");
      expect(metas[0].projectPath).toBe(TMP_DIR);

      const parsed = await parseSessionFile(metas[0].filePath);
      expect(parsed.filesModified).toContain("/tmp/out.txt");
    });
  });

  // -------------------------------------------------------------------------
  // Multi-session pipeline
  // -------------------------------------------------------------------------

  describe("multi-session pipeline", () => {
    it("scans and parses multiple sessions from different projects", async () => {
      const now = new Date();

      await makeSessionFile(
        "projects/-Users-nick-project-a/sessions/sess-a.jsonl",
        jsonlLines(
          { type: "human", timestamp: "2024-06-01T10:00:00Z" },
          {
            type: "assistant",
            timestamp: "2024-06-01T10:00:05Z",
            message: {
              content: [
                { type: "tool_use", name: "Read", input: {} },
              ],
            },
          },
          { type: "summary", costUSD: 0.03 }
        ),
        now
      );

      await makeSessionFile(
        "projects/-Users-nick-project-b/sessions/sess-b.jsonl",
        jsonlLines(
          { type: "human", timestamp: "2024-06-02T12:00:00Z" },
          {
            type: "assistant",
            timestamp: "2024-06-02T12:00:10Z",
            message: {
              content: [
                { type: "tool_use", name: "Write", input: { file_path: "/proj/main.ts" } },
              ],
            },
          },
          { type: "summary", costUSD: 0.04 }
        ),
        now
      );

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(2);

      const sessionIds = metas.map((m) => m.sessionId);
      expect(sessionIds).toContain("sess-a");
      expect(sessionIds).toContain("sess-b");

      const results = await Promise.all(metas.map((m) => parseSessionFile(m.filePath)));
      const totalMessages = results.reduce((sum, r) => sum + r.messageCount, 0);
      expect(totalMessages).toBe(4);

      const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
      expect(totalCost).toBeCloseTo(0.07);
    });

    it("handles mixed project and global sessions in the pipeline", async () => {
      const now = new Date();

      await makeSessionFile(
        "projects/-Users-nick-app/sessions/proj-sess.jsonl",
        jsonlLines(
          { type: "human", timestamp: "2024-01-01T00:00:00Z" },
          { type: "summary", costUSD: 0.01 }
        ),
        now
      );

      await makeSessionFile(
        "sessions/global-sess.jsonl",
        jsonlLines(
          { type: "human", timestamp: "2024-01-01T01:00:00Z" },
          { type: "human", timestamp: "2024-01-01T01:01:00Z" },
          { type: "summary", costUSD: 0.02 }
        ),
        now
      );

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(2);

      const parsedBySessionId: Record<string, ParsedSession> = {};
      for (const meta of metas) {
        parsedBySessionId[meta.sessionId] = await parseSessionFile(meta.filePath);
      }

      expect(parsedBySessionId["proj-sess"].messageCount).toBe(1);
      expect(parsedBySessionId["proj-sess"].costUsd).toBeCloseTo(0.01);
      expect(parsedBySessionId["global-sess"].messageCount).toBe(2);
      expect(parsedBySessionId["global-sess"].costUsd).toBeCloseTo(0.02);
    });

    it("correctly maps session metadata fields through the pipeline", async () => {
      const now = new Date();
      await makeSessionFile(
        "projects/-Users-alice-workspace/sessions/my-session-id.jsonl",
        jsonlLines({ type: "human", timestamp: "2024-06-01T10:00:00Z" }),
        now
      );

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(1);

      const meta = metas[0];
      expect(meta.sessionId).toBe("my-session-id");
      expect(meta.projectPath).toBe("/Users/alice/workspace");
      expect(meta.mtime).toBeInstanceOf(Date);

      const parsed = await parseSessionFile(meta.filePath);
      expect(parsed.messageCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Tool usage and file tracking through the pipeline
  // -------------------------------------------------------------------------

  describe("tool and file tracking through the pipeline", () => {
    it("tracks Write tool file modifications through the pipeline", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-06-01T10:00:00Z" },
        {
          type: "assistant",
          timestamp: "2024-06-01T10:00:05Z",
          message: {
            content: [
              { type: "tool_use", name: "Write", input: { file_path: "/project/src/index.ts" } },
              { type: "tool_use", name: "Write", input: { file_path: "/project/src/utils.ts" } },
            ],
          },
        }
      );

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/write-session.jsonl",
        content,
        new Date()
      );

      const [meta] = await scanSessionFiles(30, TMP_DIR);
      const parsed = await parseSessionFile(meta.filePath);

      expect(parsed.filesModified).toContain("/project/src/index.ts");
      expect(parsed.filesModified).toContain("/project/src/utils.ts");
    });

    it("tracks Edit tool file modifications through the pipeline", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-06-01T10:00:00Z" },
        {
          type: "assistant",
          timestamp: "2024-06-01T10:00:05Z",
          message: {
            content: [
              { type: "tool_use", name: "Edit", input: { file_path: "/project/app.ts" } },
            ],
          },
        }
      );

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/edit-session.jsonl",
        content,
        new Date()
      );

      const [meta] = await scanSessionFiles(30, TMP_DIR);
      const parsed = await parseSessionFile(meta.filePath);

      expect(parsed.filesModified).toContain("/project/app.ts");
      expect(parsed.toolsUsed).toContain("Edit");
    });

    it("tracks MultiEdit tool file modifications through the pipeline", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-06-01T10:00:00Z" },
        {
          type: "assistant",
          timestamp: "2024-06-01T10:00:05Z",
          message: {
            content: [
              {
                type: "tool_use",
                name: "MultiEdit",
                input: {
                  edits: [
                    { file_path: "/project/a.ts" },
                    { file_path: "/project/b.ts" },
                  ],
                },
              },
            ],
          },
        }
      );

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/multiedit-session.jsonl",
        content,
        new Date()
      );

      const [meta] = await scanSessionFiles(30, TMP_DIR);
      const parsed = await parseSessionFile(meta.filePath);

      expect(parsed.filesModified).toContain("/project/a.ts");
      expect(parsed.filesModified).toContain("/project/b.ts");
    });

    it("deduplicates tool names across multiple assistant turns in the pipeline", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-06-01T10:00:00Z" },
        {
          type: "assistant",
          timestamp: "2024-06-01T10:00:05Z",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: {} },
            ],
          },
        },
        { type: "human", timestamp: "2024-06-01T10:01:00Z" },
        {
          type: "assistant",
          timestamp: "2024-06-01T10:01:05Z",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: {} },
              { type: "tool_use", name: "Read", input: {} },
            ],
          },
        }
      );

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/dedup-session.jsonl",
        content,
        new Date()
      );

      const [meta] = await scanSessionFiles(30, TMP_DIR);
      const parsed = await parseSessionFile(meta.filePath);

      expect(parsed.toolsUsed.filter((t) => t === "Bash").length).toBe(1);
      expect(parsed.toolsUsed).toContain("Read");
    });
  });

  // -------------------------------------------------------------------------
  // Cost and timestamp tracking through the pipeline
  // -------------------------------------------------------------------------

  describe("cost and timestamp tracking through the pipeline", () => {
    it("accumulates cost from multiple summary entries through the pipeline", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-06-01T10:00:00Z" },
        { type: "summary", costUSD: 0.05 },
        { type: "summary", costUSD: 0.07 }
      );

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/cost-session.jsonl",
        content,
        new Date()
      );

      const [meta] = await scanSessionFiles(30, TMP_DIR);
      const parsed = await parseSessionFile(meta.filePath);

      expect(parsed.costUsd).toBeCloseTo(0.12);
    });

    it("tracks session timestamps from start to end through the pipeline", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-06-01T10:00:00Z" },
        { type: "human", timestamp: "2024-06-01T10:05:00Z" },
        { type: "human", timestamp: "2024-06-01T10:02:00Z" }
      );

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/time-session.jsonl",
        content,
        new Date()
      );

      const [meta] = await scanSessionFiles(30, TMP_DIR);
      const parsed = await parseSessionFile(meta.filePath);

      expect(parsed.startedAt!.toISOString()).toBe("2024-06-01T10:00:00.000Z");
      expect(parsed.endedAt!.toISOString()).toBe("2024-06-01T10:05:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // Error handling through the pipeline
  // -------------------------------------------------------------------------

  describe("error handling through the pipeline", () => {
    it("collects error entries through the pipeline", async () => {
      const content = jsonlLines(
        { type: "human", timestamp: "2024-06-01T10:00:00Z" },
        { type: "error", message: "Tool execution failed" },
        { type: "error", message: "Timeout after 30s" }
      );

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/error-session.jsonl",
        content,
        new Date()
      );

      const [meta] = await scanSessionFiles(30, TMP_DIR);
      const parsed = await parseSessionFile(meta.filePath);

      expect(parsed.errorsEncountered).toContain("Tool execution failed");
      expect(parsed.errorsEncountered).toContain("Timeout after 30s");
    });

    it("skips malformed lines and still parses valid content through the pipeline", async () => {
      const content = [
        "{ invalid json",
        JSON.stringify({ type: "human", timestamp: "2024-06-01T10:00:00Z" }),
        "not json at all",
        JSON.stringify({ type: "summary", costUSD: 0.01 }),
      ].join("\n");

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/malformed-session.jsonl",
        content,
        new Date()
      );

      const [meta] = await scanSessionFiles(30, TMP_DIR);
      const parsed = await parseSessionFile(meta.filePath);

      expect(parsed.messageCount).toBe(1);
      expect(parsed.costUsd).toBeCloseTo(0.01);
    });

    it("handles empty session files gracefully in the pipeline", async () => {
      await makeSessionFile(
        "projects/-Users-nick-project/sessions/empty-session.jsonl",
        "",
        new Date()
      );

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(1);

      const parsed = await parseSessionFile(metas[0].filePath);
      expect(parsed.messageCount).toBe(0);
      expect(parsed.toolsUsed).toEqual([]);
      expect(parsed.filesModified).toEqual([]);
      expect(parsed.costUsd).toBe(0);
      expect(parsed.startedAt).toBeNull();
      expect(parsed.endedAt).toBeNull();
    });

    it("returns empty scan results when base path does not exist", async () => {
      const metas = await scanSessionFiles(30, join(TMP_DIR, "nonexistent"));
      expect(metas).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Lookback filtering through the pipeline
  // -------------------------------------------------------------------------

  describe("lookback filtering in the pipeline", () => {
    it("only returns files within the lookback window", async () => {
      const recentMtime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const oldMtime = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/recent.jsonl",
        jsonlLines({ type: "human", timestamp: "2024-01-01T10:00:00Z" }),
        recentMtime
      );
      await makeSessionFile(
        "projects/-Users-nick-project/sessions/old.jsonl",
        jsonlLines({ type: "human", timestamp: "2023-06-01T10:00:00Z" }),
        oldMtime
      );

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(1);
      expect(metas[0].sessionId).toBe("recent");

      const parsed = await parseSessionFile(metas[0].filePath);
      expect(parsed.messageCount).toBe(1);
    });

    it("uses sinceTimestamp to filter sessions in the pipeline", async () => {
      const recentMtime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const oldMtime = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const sinceTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      await makeSessionFile(
        "projects/-Users-nick-project/sessions/recent.jsonl",
        jsonlLines({ type: "human", timestamp: "2024-02-01T10:00:00Z" }),
        recentMtime
      );
      await makeSessionFile(
        "projects/-Users-nick-project/sessions/older.jsonl",
        jsonlLines({ type: "human", timestamp: "2024-01-01T10:00:00Z" }),
        oldMtime
      );

      const metas = await scanSessionFiles(30, TMP_DIR, sinceTimestamp);
      expect(metas).toHaveLength(1);
      expect(metas[0].sessionId).toBe("recent");
    });
  });

  // -------------------------------------------------------------------------
  // Realistic end-to-end scenario
  // -------------------------------------------------------------------------

  describe("realistic end-to-end scenario", () => {
    it("processes a realistic multi-session workspace through the full pipeline", async () => {
      const now = new Date();

      // Project A: active coding session
      await makeSessionFile(
        "projects/-Users-nick-my-app/sessions/coding-session.jsonl",
        jsonlLines(
          { type: "human", timestamp: "2024-06-01T09:00:00Z" },
          {
            type: "assistant",
            timestamp: "2024-06-01T09:00:10Z",
            message: {
              content: [
                { type: "tool_use", name: "Read", input: {} },
                { type: "tool_use", name: "Write", input: { file_path: "/my-app/src/api.ts" } },
                { type: "tool_use", name: "Bash", input: { command: "bun test" } },
              ],
            },
          },
          { type: "human", timestamp: "2024-06-01T09:05:00Z" },
          {
            type: "assistant",
            timestamp: "2024-06-01T09:05:30Z",
            message: {
              content: [
                { type: "tool_use", name: "Edit", input: { file_path: "/my-app/src/api.ts" } },
              ],
            },
          },
          { type: "summary", costUSD: 0.08 },
          { type: "error", message: "Lint warning: unused variable" }
        ),
        now
      );

      // Project B: documentation session
      await makeSessionFile(
        "projects/-Users-nick-docs-site/sessions/docs-session.jsonl",
        jsonlLines(
          { type: "human", timestamp: "2024-06-01T14:00:00Z" },
          {
            type: "assistant",
            timestamp: "2024-06-01T14:00:05Z",
            message: {
              content: [
                { type: "tool_use", name: "Write", input: { file_path: "/docs/guide.md" } },
              ],
            },
          },
          { type: "summary", costUSD: 0.03 }
        ),
        now
      );

      // Global session
      await makeSessionFile(
        "sessions/global-q-and-a.jsonl",
        jsonlLines(
          { type: "human", timestamp: "2024-06-01T16:00:00Z" },
          {
            type: "assistant",
            timestamp: "2024-06-01T16:00:05Z",
            message: { content: [{ type: "text", text: "Sure!" }] },
          }
        ),
        now
      );

      const metas = await scanSessionFiles(30, TMP_DIR);
      expect(metas).toHaveLength(3);

      const results: Record<string, ParsedSession> = {};
      for (const meta of metas) {
        results[meta.sessionId] = await parseSessionFile(meta.filePath);
      }

      // Coding session assertions
      const codingSession = results["coding-session"];
      expect(codingSession.messageCount).toBe(4);
      expect(codingSession.toolsUsed).toContain("Read");
      expect(codingSession.toolsUsed).toContain("Write");
      expect(codingSession.toolsUsed).toContain("Bash");
      expect(codingSession.toolsUsed).toContain("Edit");
      expect(codingSession.filesModified).toContain("/my-app/src/api.ts");
      // Write and Edit on same file → deduplicated
      expect(codingSession.filesModified.filter((f) => f === "/my-app/src/api.ts").length).toBe(1);
      expect(codingSession.costUsd).toBeCloseTo(0.08);
      expect(codingSession.errorsEncountered).toEqual(["Lint warning: unused variable"]);
      expect(codingSession.startedAt!.toISOString()).toBe("2024-06-01T09:00:00.000Z");
      expect(codingSession.endedAt!.toISOString()).toBe("2024-06-01T09:05:30.000Z");

      // Docs session assertions
      const docsSession = results["docs-session"];
      expect(docsSession.messageCount).toBe(2);
      expect(docsSession.filesModified).toContain("/docs/guide.md");
      expect(docsSession.costUsd).toBeCloseTo(0.03);

      // Global session assertions
      const globalSession = results["global-q-and-a"];
      expect(globalSession.messageCount).toBe(2);
      expect(globalSession.toolsUsed).toHaveLength(0);
      expect(globalSession.filesModified).toHaveLength(0);

      // Cross-session aggregate
      const totalCost = Object.values(results).reduce((sum, r) => sum + r.costUsd, 0);
      expect(totalCost).toBeCloseTo(0.11);
    });
  });
});
