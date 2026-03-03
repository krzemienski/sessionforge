import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { parseSessionFile, type ParsedSession } from "@/lib/sessions/parser";

// Helper to write a temp JSONL file and return its path
async function writeTempFile(lines: string[]): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `parser-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  await fs.writeFile(tmpPath, lines.join("\n"), "utf8");
  return tmpPath;
}

describe("parseSessionFile", () => {
  const tempFiles: string[] = [];

  async function tempFile(lines: string[]): Promise<string> {
    const p = await writeTempFile(lines);
    tempFiles.push(p);
    return p;
  }

  afterEach(async () => {
    for (const f of tempFiles) {
      await fs.unlink(f).catch(() => {});
    }
    tempFiles.length = 0;
  });

  describe("non-existent or empty files", () => {
    it("returns empty result for a non-existent file", async () => {
      const result = await parseSessionFile("/tmp/this-file-does-not-exist-abc123.jsonl");
      expect(result).toMatchObject<ParsedSession>({
        messageCount: 0,
        toolsUsed: [],
        filesModified: [],
        errorsEncountered: [],
        costUsd: 0,
        startedAt: null,
        endedAt: null,
      });
    });

    it("returns empty result for an empty file", async () => {
      const p = await tempFile([""]);
      // Actually write a truly empty file
      await fs.writeFile(p, "", "utf8");
      const result = await parseSessionFile(p);
      expect(result).toMatchObject<ParsedSession>({
        messageCount: 0,
        toolsUsed: [],
        filesModified: [],
        errorsEncountered: [],
        costUsd: 0,
        startedAt: null,
        endedAt: null,
      });
    });
  });

  describe("message counting", () => {
    it("counts human messages", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "human", message: "hello" }),
        JSON.stringify({ type: "human", message: "world" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.messageCount).toBe(2);
    });

    it("counts assistant messages", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "assistant", message: { content: [] } }),
        JSON.stringify({ type: "assistant", message: { content: [] } }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.messageCount).toBe(2);
    });

    it("counts both human and assistant messages together", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "human", message: "hi" }),
        JSON.stringify({ type: "assistant", message: { content: [] } }),
        JSON.stringify({ type: "human", message: "bye" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.messageCount).toBe(3);
    });

    it("does not count non-message types", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "summary", costUSD: 0.01 }),
        JSON.stringify({ type: "error", message: "something failed" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.messageCount).toBe(0);
    });
  });

  describe("tool extraction", () => {
    it("extracts tool names from assistant tool_use blocks", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: {} },
              { type: "tool_use", name: "Read", input: {} },
            ],
          },
        }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.toolsUsed).toContain("Bash");
      expect(result.toolsUsed).toContain("Read");
    });

    it("deduplicates tool names used multiple times", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: {} },
              { type: "tool_use", name: "Bash", input: {} },
              { type: "tool_use", name: "Read", input: {} },
            ],
          },
        }),
      ]);
      const result = await parseSessionFile(p);
      const bashCount = result.toolsUsed.filter((t) => t === "Bash").length;
      expect(bashCount).toBe(1);
      expect(result.toolsUsed).toHaveLength(2);
    });

    it("does not extract tools from human messages", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "human",
          message: { content: [{ type: "tool_use", name: "SomeTool", input: {} }] },
        }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.toolsUsed).toHaveLength(0);
    });

    it("ignores non-tool_use content blocks", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Here is my answer" },
            ],
          },
        }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.toolsUsed).toHaveLength(0);
    });
  });

  describe("file path extraction", () => {
    it("extracts file_path from Write tool use", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "Write",
                input: { file_path: "/src/foo.ts", content: "hello" },
              },
            ],
          },
        }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.filesModified).toContain("/src/foo.ts");
    });

    it("extracts file_path from Edit tool use", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "Edit",
                input: { file_path: "/src/bar.ts" },
              },
            ],
          },
        }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.filesModified).toContain("/src/bar.ts");
    });

    it("extracts file paths from MultiEdit edits array", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "MultiEdit",
                input: {
                  edits: [
                    { file_path: "/src/a.ts" },
                    { file_path: "/src/b.ts" },
                  ],
                },
              },
            ],
          },
        }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.filesModified).toContain("/src/a.ts");
      expect(result.filesModified).toContain("/src/b.ts");
    });

    it("deduplicates file paths modified multiple times", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "Write", input: { file_path: "/src/dup.ts" } },
              { type: "tool_use", name: "Edit", input: { file_path: "/src/dup.ts" } },
            ],
          },
        }),
      ]);
      const result = await parseSessionFile(p);
      const dupCount = result.filesModified.filter((f) => f === "/src/dup.ts").length;
      expect(dupCount).toBe(1);
    });

    it("does not extract file paths from non-file tools", async () => {
      const p = await tempFile([
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: { file_path: "/src/cmd.ts" } },
            ],
          },
        }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.filesModified).toHaveLength(0);
    });
  });

  describe("cost extraction", () => {
    it("sums costUSD from summary entries", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "summary", costUSD: 0.01 }),
        JSON.stringify({ type: "summary", costUSD: 0.02 }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.costUsd).toBeCloseTo(0.03);
    });

    it("accumulates cost across multiple summary entries", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "summary", costUSD: 1.5 }),
        JSON.stringify({ type: "summary", costUSD: 2.25 }),
        JSON.stringify({ type: "summary", costUSD: 0.75 }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.costUsd).toBeCloseTo(4.5);
    });

    it("ignores summary entries without costUSD", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "summary", someOtherField: "value" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.costUsd).toBe(0);
    });

    it("ignores non-numeric costUSD values", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "summary", costUSD: "not-a-number" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.costUsd).toBe(0);
    });
  });

  describe("error extraction", () => {
    it("collects error messages from error entries", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "error", message: "something went wrong" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.errorsEncountered).toContain("something went wrong");
    });

    it("collects multiple error messages", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "error", message: "first error" }),
        JSON.stringify({ type: "error", message: "second error" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.errorsEncountered).toEqual(["first error", "second error"]);
    });

    it("ignores error entries without a message field", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "error" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.errorsEncountered).toHaveLength(0);
    });
  });

  describe("timestamp extraction", () => {
    it("sets startedAt to the earliest timestamp", async () => {
      const early = "2024-01-01T10:00:00.000Z";
      const late = "2024-01-01T11:00:00.000Z";
      const p = await tempFile([
        JSON.stringify({ type: "human", timestamp: late }),
        JSON.stringify({ type: "assistant", timestamp: early, message: { content: [] } }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.startedAt).toEqual(new Date(early));
    });

    it("sets endedAt to the latest timestamp", async () => {
      const early = "2024-01-01T10:00:00.000Z";
      const late = "2024-01-01T12:30:00.000Z";
      const p = await tempFile([
        JSON.stringify({ type: "human", timestamp: early }),
        JSON.stringify({ type: "assistant", timestamp: late, message: { content: [] } }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.endedAt).toEqual(new Date(late));
    });

    it("leaves startedAt and endedAt null when no timestamps present", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "human", message: "no timestamp here" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.startedAt).toBeNull();
      expect(result.endedAt).toBeNull();
    });

    it("ignores invalid timestamp strings", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "human", timestamp: "not-a-date" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.startedAt).toBeNull();
      expect(result.endedAt).toBeNull();
    });

    it("sets both startedAt and endedAt to the same value with a single timestamped entry", async () => {
      const ts = "2024-06-15T09:00:00.000Z";
      const p = await tempFile([
        JSON.stringify({ type: "human", timestamp: ts }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.startedAt).toEqual(new Date(ts));
      expect(result.endedAt).toEqual(new Date(ts));
    });
  });

  describe("malformed input handling", () => {
    it("skips malformed JSON lines without crashing", async () => {
      const p = await tempFile([
        "this is not json",
        JSON.stringify({ type: "human", message: "valid" }),
        "{ broken json",
      ]);
      const result = await parseSessionFile(p);
      expect(result.messageCount).toBe(1);
    });

    it("skips blank lines without crashing", async () => {
      const p = await tempFile([
        "",
        JSON.stringify({ type: "human", message: "hello" }),
        "   ",
        JSON.stringify({ type: "human", message: "world" }),
      ]);
      const result = await parseSessionFile(p);
      expect(result.messageCount).toBe(2);
    });
  });

  describe("full session scenario", () => {
    it("correctly parses a realistic multi-entry session file", async () => {
      const p = await tempFile([
        JSON.stringify({ type: "human", timestamp: "2024-03-01T08:00:00.000Z", message: "help me write a function" }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2024-03-01T08:00:05.000Z",
          message: {
            content: [
              { type: "text", text: "Sure! Let me read the file first." },
              { type: "tool_use", name: "Read", input: { file_path: "/src/utils.ts" } },
            ],
          },
        }),
        JSON.stringify({ type: "human", timestamp: "2024-03-01T08:00:10.000Z", message: "looks good" }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2024-03-01T08:00:15.000Z",
          message: {
            content: [
              { type: "tool_use", name: "Write", input: { file_path: "/src/newfile.ts", content: "export function foo() {}" } },
            ],
          },
        }),
        JSON.stringify({ type: "summary", costUSD: 0.0042 }),
        JSON.stringify({ type: "error", message: "tool timeout" }),
      ]);

      const result = await parseSessionFile(p);

      expect(result.messageCount).toBe(4);
      expect(result.toolsUsed).toContain("Read");
      expect(result.toolsUsed).toContain("Write");
      expect(result.filesModified).toContain("/src/newfile.ts");
      expect(result.filesModified).not.toContain("/src/utils.ts"); // Read is not a file-modifying tool
      expect(result.costUsd).toBeCloseTo(0.0042);
      expect(result.errorsEncountered).toContain("tool timeout");
      expect(result.startedAt).toEqual(new Date("2024-03-01T08:00:00.000Z"));
      expect(result.endedAt).toEqual(new Date("2024-03-01T08:00:15.000Z"));
    });
  });
});
