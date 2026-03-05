/**
 * Unit tests for the session file parser.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { parseSessionFile } from "../parser";

const TMP_DIR = join(import.meta.dir, "__tmp_parser_tests__");

async function writeTmpFile(name: string, content: string): Promise<string> {
  await mkdir(TMP_DIR, { recursive: true });
  const filePath = join(TMP_DIR, name);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

function jsonlLine(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

describe("parseSessionFile", () => {
  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe("non-existent or empty files", () => {
    it("returns empty result for non-existent file", async () => {
      const result = await parseSessionFile(join(TMP_DIR, "no-such-file.jsonl"));
      expect(result.messageCount).toBe(0);
      expect(result.toolsUsed).toEqual([]);
      expect(result.filesModified).toEqual([]);
      expect(result.errorsEncountered).toEqual([]);
      expect(result.costUsd).toBe(0);
      expect(result.startedAt).toBeNull();
      expect(result.endedAt).toBeNull();
    });

    it("returns empty result for empty file", async () => {
      const filePath = await writeTmpFile("empty.jsonl", "");
      const result = await parseSessionFile(filePath);
      expect(result.messageCount).toBe(0);
      expect(result.toolsUsed).toEqual([]);
      expect(result.filesModified).toEqual([]);
      expect(result.errorsEncountered).toEqual([]);
      expect(result.costUsd).toBe(0);
      expect(result.startedAt).toBeNull();
      expect(result.endedAt).toBeNull();
    });
  });

  describe("message counting", () => {
    it("counts human messages", async () => {
      const lines = [
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:00:00Z" }),
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:01:00Z" }),
      ].join("\n");
      const filePath = await writeTmpFile("human.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.messageCount).toBe(2);
    });

    it("counts assistant messages", async () => {
      const lines = [
        jsonlLine({ type: "assistant", timestamp: "2024-01-01T00:00:00Z", message: { content: [] } }),
        jsonlLine({ type: "assistant", timestamp: "2024-01-01T00:01:00Z", message: { content: [] } }),
      ].join("\n");
      const filePath = await writeTmpFile("assistant.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.messageCount).toBe(2);
    });

    it("counts both human and assistant messages", async () => {
      const lines = [
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:00:00Z" }),
        jsonlLine({ type: "assistant", timestamp: "2024-01-01T00:01:00Z", message: { content: [] } }),
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:02:00Z" }),
      ].join("\n");
      const filePath = await writeTmpFile("mixed.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.messageCount).toBe(3);
    });

    it("does not count non-message types", async () => {
      const lines = [
        jsonlLine({ type: "summary", costUSD: 0.01 }),
        jsonlLine({ type: "error", message: "oops" }),
      ].join("\n");
      const filePath = await writeTmpFile("nonmsg.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.messageCount).toBe(0);
    });
  });

  describe("tool usage extraction", () => {
    it("extracts tool names from assistant tool_use blocks", async () => {
      const lines = [
        jsonlLine({
          type: "assistant",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: {} },
              { type: "tool_use", name: "Read", input: {} },
            ],
          },
        }),
      ].join("\n");
      const filePath = await writeTmpFile("tools.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.toolsUsed).toContain("Bash");
      expect(result.toolsUsed).toContain("Read");
    });

    it("deduplicates tool names", async () => {
      const lines = [
        jsonlLine({
          type: "assistant",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: {} },
              { type: "tool_use", name: "Bash", input: {} },
            ],
          },
        }),
      ].join("\n");
      const filePath = await writeTmpFile("dedup-tools.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.toolsUsed.filter((t) => t === "Bash").length).toBe(1);
    });

    it("does not extract tools from human messages", async () => {
      const lines = [
        jsonlLine({
          type: "human",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            content: [{ type: "tool_use", name: "ShouldNotAppear", input: {} }],
          },
        }),
      ].join("\n");
      const filePath = await writeTmpFile("human-no-tools.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.toolsUsed).not.toContain("ShouldNotAppear");
    });
  });

  describe("files modified extraction", () => {
    it("extracts file_path from Write tool", async () => {
      const lines = [
        jsonlLine({
          type: "assistant",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            content: [
              { type: "tool_use", name: "Write", input: { file_path: "/project/src/app.ts" } },
            ],
          },
        }),
      ].join("\n");
      const filePath = await writeTmpFile("write-tool.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.filesModified).toContain("/project/src/app.ts");
    });

    it("extracts file_path from Edit tool", async () => {
      const lines = [
        jsonlLine({
          type: "assistant",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            content: [
              { type: "tool_use", name: "Edit", input: { file_path: "/project/src/utils.ts" } },
            ],
          },
        }),
      ].join("\n");
      const filePath = await writeTmpFile("edit-tool.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.filesModified).toContain("/project/src/utils.ts");
    });

    it("extracts file paths from MultiEdit edits array", async () => {
      const lines = [
        jsonlLine({
          type: "assistant",
          timestamp: "2024-01-01T00:00:00Z",
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
        }),
      ].join("\n");
      const filePath = await writeTmpFile("multiedit.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.filesModified).toContain("/project/a.ts");
      expect(result.filesModified).toContain("/project/b.ts");
    });

    it("deduplicates file paths", async () => {
      const lines = [
        jsonlLine({
          type: "assistant",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            content: [
              { type: "tool_use", name: "Write", input: { file_path: "/project/app.ts" } },
              { type: "tool_use", name: "Edit", input: { file_path: "/project/app.ts" } },
            ],
          },
        }),
      ].join("\n");
      const filePath = await writeTmpFile("dedup-files.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.filesModified.filter((f) => f === "/project/app.ts").length).toBe(1);
    });

    it("does not add file paths for non-file tools", async () => {
      const lines = [
        jsonlLine({
          type: "assistant",
          timestamp: "2024-01-01T00:00:00Z",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: { file_path: "/should/not/appear.ts" } },
            ],
          },
        }),
      ].join("\n");
      const filePath = await writeTmpFile("non-file-tool.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.filesModified).not.toContain("/should/not/appear.ts");
    });
  });

  describe("cost accumulation", () => {
    it("accumulates cost from summary entries", async () => {
      const lines = [
        jsonlLine({ type: "summary", costUSD: 0.05 }),
        jsonlLine({ type: "summary", costUSD: 0.10 }),
      ].join("\n");
      const filePath = await writeTmpFile("cost.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.costUsd).toBeCloseTo(0.15);
    });

    it("ignores summary entries without costUSD", async () => {
      const lines = [
        jsonlLine({ type: "summary" }),
        jsonlLine({ type: "summary", costUSD: 0.02 }),
      ].join("\n");
      const filePath = await writeTmpFile("cost-missing.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.costUsd).toBeCloseTo(0.02);
    });

    it("starts at 0 when no summary entries", async () => {
      const lines = [
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:00:00Z" }),
      ].join("\n");
      const filePath = await writeTmpFile("no-cost.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.costUsd).toBe(0);
    });
  });

  describe("error collection", () => {
    it("collects error messages", async () => {
      const lines = [
        jsonlLine({ type: "error", message: "Something went wrong" }),
        jsonlLine({ type: "error", message: "Another error" }),
      ].join("\n");
      const filePath = await writeTmpFile("errors.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.errorsEncountered).toEqual(["Something went wrong", "Another error"]);
    });

    it("ignores error entries without message field", async () => {
      const lines = [
        jsonlLine({ type: "error" }),
        jsonlLine({ type: "error", message: "Valid error" }),
      ].join("\n");
      const filePath = await writeTmpFile("error-no-msg.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.errorsEncountered).toEqual(["Valid error"]);
    });
  });

  describe("timestamp tracking", () => {
    it("sets startedAt to earliest timestamp", async () => {
      const lines = [
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:05:00Z" }),
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:01:00Z" }),
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:10:00Z" }),
      ].join("\n");
      const filePath = await writeTmpFile("timestamps.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.startedAt).not.toBeNull();
      expect(result.startedAt!.toISOString()).toBe("2024-01-01T00:01:00.000Z");
    });

    it("sets endedAt to latest timestamp", async () => {
      const lines = [
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:05:00Z" }),
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:01:00Z" }),
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:10:00Z" }),
      ].join("\n");
      const filePath = await writeTmpFile("timestamps2.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.endedAt).not.toBeNull();
      expect(result.endedAt!.toISOString()).toBe("2024-01-01T00:10:00.000Z");
    });

    it("returns null timestamps when no entries have timestamps", async () => {
      const lines = [
        jsonlLine({ type: "human" }),
      ].join("\n");
      const filePath = await writeTmpFile("no-timestamps.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.startedAt).toBeNull();
      expect(result.endedAt).toBeNull();
    });

    it("ignores invalid timestamp strings", async () => {
      const lines = [
        jsonlLine({ type: "human", timestamp: "not-a-date" }),
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:00:00Z" }),
      ].join("\n");
      const filePath = await writeTmpFile("bad-timestamp.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.startedAt!.toISOString()).toBe("2024-01-01T00:00:00.000Z");
      expect(result.endedAt!.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("malformed lines", () => {
    it("skips malformed JSON lines", async () => {
      const lines = [
        "this is not json",
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:00:00Z" }),
        "{broken",
      ].join("\n");
      const filePath = await writeTmpFile("malformed.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.messageCount).toBe(1);
    });

    it("skips blank lines", async () => {
      const lines = [
        "",
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:00:00Z" }),
        "   ",
        jsonlLine({ type: "human", timestamp: "2024-01-01T00:01:00Z" }),
      ].join("\n");
      const filePath = await writeTmpFile("blanks.jsonl", lines);
      const result = await parseSessionFile(filePath);
      expect(result.messageCount).toBe(2);
    });
  });

  describe("comprehensive session", () => {
    it("parses a realistic session correctly", async () => {
      const lines = [
        jsonlLine({ type: "human", timestamp: "2024-06-01T10:00:00Z" }),
        jsonlLine({
          type: "assistant",
          timestamp: "2024-06-01T10:00:05Z",
          message: {
            content: [
              { type: "text", text: "Let me help you." },
              { type: "tool_use", name: "Read", input: { file_path: "/project/main.ts" } },
            ],
          },
        }),
        jsonlLine({ type: "human", timestamp: "2024-06-01T10:01:00Z" }),
        jsonlLine({
          type: "assistant",
          timestamp: "2024-06-01T10:01:10Z",
          message: {
            content: [
              { type: "tool_use", name: "Write", input: { file_path: "/project/main.ts" } },
              { type: "tool_use", name: "Bash", input: { command: "bun test" } },
            ],
          },
        }),
        jsonlLine({ type: "summary", costUSD: 0.03 }),
        jsonlLine({ type: "summary", costUSD: 0.02 }),
        jsonlLine({ type: "error", message: "lint warning" }),
      ].join("\n");

      const filePath = await writeTmpFile("realistic.jsonl", lines);
      const result = await parseSessionFile(filePath);

      expect(result.messageCount).toBe(4);
      expect(result.toolsUsed).toContain("Read");
      expect(result.toolsUsed).toContain("Write");
      expect(result.toolsUsed).toContain("Bash");
      expect(result.filesModified).toContain("/project/main.ts");
      expect(result.costUsd).toBeCloseTo(0.05);
      expect(result.errorsEncountered).toEqual(["lint warning"]);
      expect(result.startedAt!.toISOString()).toBe("2024-06-01T10:00:00.000Z");
      expect(result.endedAt!.toISOString()).toBe("2024-06-01T10:01:10.000Z");
    });
  });
});
