/**
 * Session file parser for extracting structured data from Claude JSONL session files.
 * Streams each file line-by-line to minimise memory usage, collecting tool usage,
 * modified file paths, cost data, timestamps, and errors from the raw event log.
 */

import fs from "fs/promises";
import readline from "readline";
import { createReadStream } from "fs";
import { Readable } from "stream";

/** A compact user/assistant message extracted from the session for corpus analysis. */
export interface SampleMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

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
  /** Auto-generated summary from the first user message(s). */
  summary: string | null;
  /** Sample messages for corpus analysis (first 3 user + first 2 assistant, truncated). */
  sampleMessages: SampleMessage[];
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

/** Max chars per sample message to keep DB size manageable. */
const MAX_MESSAGE_LENGTH = 800;
/** Max user messages to sample. */
const MAX_USER_SAMPLES = 3;
/** Max assistant messages to sample. */
const MAX_ASSISTANT_SAMPLES = 2;

/** Internal mutable state used during line-by-line parsing. */
interface ParseState {
  result: ParsedSession;
  toolsSet: Set<string>;
  filesSet: Set<string>;
  userSamples: SampleMessage[];
  assistantSamples: SampleMessage[];
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
      summary: null,
      sampleMessages: [],
    },
    toolsSet: new Set<string>(),
    filesSet: new Set<string>(),
    userSamples: [],
    assistantSamples: [],
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

  if (type === "human" || type === "user" || type === "assistant") {
    state.result.messageCount++;

    if (type === "human" || type === "user") {
      // Capture sample user messages for corpus analysis
      if (state.userSamples.length < MAX_USER_SAMPLES) {
        const msg = entry.message as string | Record<string, unknown> | undefined;
        let text = "";
        if (typeof msg === "string") {
          text = msg;
        } else if (msg && typeof msg === "object") {
          const content = (msg as Record<string, unknown>).content;
          if (typeof content === "string") {
            text = content;
          } else if (Array.isArray(content)) {
            text = content
              .filter((b: unknown) => typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "text")
              .map((b: unknown) => (b as Record<string, unknown>).text as string)
              .join("\n");
          }
        }
        if (text.length > 0) {
          state.userSamples.push({
            role: "user",
            content: text.slice(0, MAX_MESSAGE_LENGTH),
            timestamp: ts?.toISOString(),
          });
        }
      }
    }

    if (type === "assistant") {
      const msg = entry.message as Record<string, unknown> | undefined;
      const content = msg?.content;
      if (Array.isArray(content)) {
        // Capture sample assistant text for corpus analysis
        if (state.assistantSamples.length < MAX_ASSISTANT_SAMPLES) {
          const textBlocks = content
            .filter((b: unknown) => typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "text")
            .map((b: unknown) => (b as Record<string, unknown>).text as string);
          const text = textBlocks.join("\n");
          if (text.length > 0) {
            state.assistantSamples.push({
              role: "assistant",
              content: text.slice(0, MAX_MESSAGE_LENGTH),
              timestamp: ts?.toISOString(),
            });
          }
        }

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

/** Finalizes parse state by converting sets to arrays and generating summary. */
function finalizeState(state: ParseState): ParsedSession {
  // Interleave user/assistant samples in conversation order
  const sampleMessages: SampleMessage[] = [];
  const maxLen = Math.max(state.userSamples.length, state.assistantSamples.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < state.userSamples.length) sampleMessages.push(state.userSamples[i]);
    if (i < state.assistantSamples.length) sampleMessages.push(state.assistantSamples[i]);
  }

  // Generate summary from first user message + metadata
  const firstUserMsg = state.userSamples[0]?.content ?? "";
  const toolsList = Array.from(state.toolsSet);
  const filesList = Array.from(state.filesSet);

  let summary: string | null = null;
  if (firstUserMsg.length > 0) {
    const parts = [`Task: ${firstUserMsg.slice(0, 300)}`];
    if (toolsList.length > 0) parts.push(`Tools: ${toolsList.slice(0, 10).join(", ")}`);
    if (filesList.length > 0) parts.push(`Files modified: ${filesList.slice(0, 8).join(", ")}`);
    if (state.result.errorsEncountered.length > 0) {
      parts.push(`Errors: ${state.result.errorsEncountered.slice(0, 3).join("; ").slice(0, 200)}`);
    }
    summary = parts.join(". ");
  }

  return {
    ...state.result,
    toolsUsed: toolsList,
    filesModified: filesList,
    summary,
    sampleMessages,
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
