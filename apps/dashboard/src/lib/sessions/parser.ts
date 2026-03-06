/**
 * Session file parser for extracting structured data from Claude JSONL session files.
 * Streams each file line-by-line to minimise memory usage, collecting tool usage,
 * modified file paths, cost data, timestamps, and errors from the raw event log.
 */

import fs from "fs/promises";
import readline from "readline";
import { createReadStream } from "fs";
import { Readable } from "stream";

/** Structured summary of the events recorded in a single Claude session file. */
export interface ParsedSession {
  /** Total number of human and assistant messages in the session. */
  messageCount: number;
  /** Deduplicated list of Anthropic tool names invoked during the session. */
  toolsUsed: string[];
  /** Deduplicated list of file paths written or edited during the session. */
  filesModified: string[];
  /** Error messages recorded in `error`-type JSONL entries. */
  errorsEncountered: string[];
  /** Cumulative cost in USD summed from all `summary` entries. */
  costUsd: number;
  /** Timestamp of the earliest event in the file, or `null` if none found. */
  startedAt: Date | null;
  /** Timestamp of the latest event in the file, or `null` if none found. */
  endedAt: Date | null;
}

/**
 * Tool names that indicate a file write or edit operation.
 * When these tools are invoked the parser extracts the target `file_path`
 * and adds it to the session's `filesModified` set.
 */
const FILE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"]);

/**
 * Extracts a `Date` from the `timestamp` field of a raw JSONL entry.
 *
 * @param entry - A parsed JSONL object that may contain a `timestamp` string.
 * @returns A valid `Date` instance, or `null` if the field is absent or unparseable.
 */
function extractTimestamp(entry: Record<string, unknown>): Date | null {
  const ts = entry.timestamp;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Internal mutable state used during line-by-line parsing. */
interface ParseState {
  result: ParsedSession;
  toolsSet: Set<string>;
  filesSet: Set<string>;
}

function createParseState(): ParseState {
  return {
    result: {
      messageCount: 0,
      toolsUsed: [],
      filesModified: [],
      errorsEncountered: [],
      costUsd: 0,
      startedAt: null,
      endedAt: null,
    },
    toolsSet: new Set<string>(),
    filesSet: new Set<string>(),
  };
}

/**
 * Processes a single JSONL line, updating the parse state in place.
 * Shared by both parseSessionFile and parseSessionBuffer.
 */
function processLine(line: string, state: ParseState): void {
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
    if (!state.result.startedAt || ts < state.result.startedAt) state.result.startedAt = ts;
    if (!state.result.endedAt || ts > state.result.endedAt) state.result.endedAt = ts;
  }

  if (type === "human" || type === "assistant") {
    state.result.messageCount++;

    if (type === "assistant") {
      const msg = entry.message as Record<string, unknown> | undefined;
      const content = msg?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== "object") continue;
          const b = block as Record<string, unknown>;
          if (b.type === "tool_use") {
            const name = b.name as string;
            if (name) state.toolsSet.add(name);
            if (FILE_TOOL_NAMES.has(name)) {
              const input = b.input as Record<string, unknown> | undefined;
              const fp = input?.file_path as string | undefined;
              if (fp) state.filesSet.add(fp);
              // MultiEdit may have array of edits
              const edits = input?.edits as
                | { file_path?: string }[]
                | undefined;
              if (Array.isArray(edits)) {
                for (const edit of edits) {
                  if (edit?.file_path) state.filesSet.add(edit.file_path);
                }
              }
            }
          }
        }
      }
    }
  } else if (type === "summary") {
    const cost = entry.costUSD as number | undefined;
    if (typeof cost === "number") state.result.costUsd += cost;
  } else if (type === "error") {
    const msg = entry.message as string | undefined;
    if (msg) state.result.errorsEncountered.push(msg);
  }
}

/** Finalizes parse state by converting sets to arrays. */
function finalizeState(state: ParseState): ParsedSession {
  return {
    ...state.result,
    toolsUsed: Array.from(state.toolsSet),
    filesModified: Array.from(state.filesSet),
  };
}

/**
 * Parses a Claude session JSONL file and returns a structured summary.
 *
 * Opens the file using a streaming readline interface to avoid loading the
 * entire file into memory.
 *
 * @param filePath - Absolute path to the `.jsonl` session file to parse.
 * @returns A {@link ParsedSession} containing all extracted session data.
 */
export async function parseSessionFile(
  filePath: string
): Promise<ParsedSession> {
  const state = createParseState();

  let fileHandle: fs.FileHandle | null = null;
  try {
    fileHandle = await fs.open(filePath, "r");
    const stat = await fileHandle.stat();
    if (stat.size === 0) return state.result;
  } catch {
    return state.result;
  } finally {
    await fileHandle?.close();
  }

  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => processLine(line, state));

    rl.on("close", () => resolve(finalizeState(state)));

    rl.on("error", () => resolve(finalizeState(state)));
  });
}

/**
 * Parses a Claude session JSONL buffer and returns a structured summary.
 *
 * Creates a streaming readline interface from the buffer.
 *
 * @param buffer - Buffer containing JSONL session data.
 * @returns A {@link ParsedSession} containing all extracted session data.
 */
export async function parseSessionBuffer(
  buffer: Buffer
): Promise<ParsedSession> {
  const state = createParseState();

  if (buffer.length === 0) return state.result;

  return new Promise((resolve) => {
    const stream = Readable.from(buffer.toString("utf8"));
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => processLine(line, state));

    rl.on("close", () => resolve(finalizeState(state)));

    rl.on("error", () => resolve(finalizeState(state)));
  });
}
