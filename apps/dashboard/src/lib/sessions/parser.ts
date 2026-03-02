import fs from "fs/promises";
import readline from "readline";
import { createReadStream } from "fs";

export interface ParsedSession {
  messageCount: number;
  toolsUsed: string[];
  filesModified: string[];
  errorsEncountered: string[];
  costUsd: number;
  startedAt: Date | null;
  endedAt: Date | null;
}

const FILE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"]);

function extractTimestamp(entry: Record<string, unknown>): Date | null {
  const ts = entry.timestamp;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function parseSessionFile(
  filePath: string
): Promise<ParsedSession> {
  const result: ParsedSession = {
    messageCount: 0,
    toolsUsed: [],
    filesModified: [],
    errorsEncountered: [],
    costUsd: 0,
    startedAt: null,
    endedAt: null,
  };

  const toolsSet = new Set<string>();
  const filesSet = new Set<string>();

  let fileHandle: fs.FileHandle | null = null;
  try {
    fileHandle = await fs.open(filePath, "r");
    const stat = await fileHandle.stat();
    if (stat.size === 0) return result;
  } catch {
    return result;
  } finally {
    await fileHandle?.close();
  }

  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        return; // skip malformed lines
      }

      const type = entry.type as string | undefined;
      const ts = extractTimestamp(entry);
      if (ts) {
        if (!result.startedAt || ts < result.startedAt) result.startedAt = ts;
        if (!result.endedAt || ts > result.endedAt) result.endedAt = ts;
      }

      if (type === "human" || type === "assistant") {
        result.messageCount++;

        if (type === "assistant") {
          const msg = entry.message as Record<string, unknown> | undefined;
          const content = msg?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (!block || typeof block !== "object") continue;
              const b = block as Record<string, unknown>;
              if (b.type === "tool_use") {
                const name = b.name as string;
                if (name) toolsSet.add(name);
                if (FILE_TOOL_NAMES.has(name)) {
                  const input = b.input as Record<string, unknown> | undefined;
                  const fp = input?.file_path as string | undefined;
                  if (fp) filesSet.add(fp);
                  // MultiEdit may have array of edits
                  const edits = input?.edits as
                    | { file_path?: string }[]
                    | undefined;
                  if (Array.isArray(edits)) {
                    for (const edit of edits) {
                      if (edit?.file_path) filesSet.add(edit.file_path);
                    }
                  }
                }
              }
            }
          }
        }
      } else if (type === "summary") {
        const cost = entry.costUSD as number | undefined;
        if (typeof cost === "number") result.costUsd += cost;
      } else if (type === "error") {
        const msg = entry.message as string | undefined;
        if (msg) result.errorsEncountered.push(msg);
      }
    });

    rl.on("close", () => {
      result.toolsUsed = Array.from(toolsSet);
      result.filesModified = Array.from(filesSet);
      resolve(result);
    });

    rl.on("error", () => {
      result.toolsUsed = Array.from(toolsSet);
      result.filesModified = Array.from(filesSet);
      resolve(result);
    });
  });
}
