/**
 * Session normalizer that combines raw scanner metadata and parsed session data
 * into a single, flat {@link NormalizedSession} record ready for database storage.
 * Derives computed fields such as `projectName`, `durationSeconds`, and
 * a fallback `startedAt` from the file's modification time when no timestamps
 * are present in the session log.
 */

import path from "path";
import type { SessionFileMeta } from "./scanner";
import type { ParsedSession, SampleMessage } from "./parser";

/** A fully normalised session record combining file metadata and parsed content. */
export interface NormalizedSession {
  /** UUID-style session identifier. */
  sessionId: string;
  /** Decoded absolute path of the project directory this session belongs to. */
  projectPath: string;
  /** Human-readable project name derived from the final path segment. */
  projectName: string;
  /** Absolute path to the source JSONL file on disk. */
  filePath: string;
  /** Total number of human and assistant turns in the session. */
  messageCount: number;
  /** Deduplicated list of Anthropic tool names used in the session. */
  toolsUsed: string[];
  /** Deduplicated list of file paths modified during the session. */
  filesModified: string[];
  /** Error messages recorded in the session log. */
  errorsEncountered: string[];
  /** Total cost in USD, or `null` if no cost data was found. */
  costUsd: number | null;
  /** Session start time; falls back to the file's `mtime` if no timestamps exist. */
  startedAt: Date;
  /** Session end time, or `null` if the session has no closing timestamp. */
  endedAt: Date | null;
  /** Wall-clock duration in seconds, or `null` if start/end times are unavailable. */
  durationSeconds: number | null;
  /** Auto-generated summary from the first user message(s) and metadata. */
  summary: string | null;
  /** Sample messages for corpus analysis, stored as rawMetadata in the DB. */
  rawMetadata: { messages: SampleMessage[] } | null;
}

/**
 * Merges {@link SessionFileMeta} and {@link ParsedSession} into a {@link NormalizedSession}.
 *
 * Applies the following normalisation rules:
 * - `startedAt` falls back to `meta.mtime` when the parser found no timestamps.
 * - `costUsd` is set to `null` when the parsed value is zero (no billing data).
 * - `durationSeconds` is computed from `startedAt` and `endedAt`; `null` when
 *   `endedAt` is not available.
 * - `projectName` is the last segment of `meta.projectPath`, falling back to
 *   the full path when the basename is empty.
 *
 * @param meta - File-system metadata returned by the scanner.
 * @param parsed - Structured session data returned by the parser.
 * @returns A {@link NormalizedSession} ready for upsert into the database.
 */
export function normalizeSession(
  meta: SessionFileMeta,
  parsed: ParsedSession
): NormalizedSession {
  const startedAt = parsed.startedAt ?? meta.mtime;
  const endedAt = parsed.endedAt ?? null;

  let durationSeconds: number | null = null;
  if (endedAt && startedAt) {
    durationSeconds = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 1000
    );
  }

  const projectName = path.basename(meta.projectPath) || meta.projectPath;

  return {
    sessionId: meta.sessionId,
    projectPath: meta.projectPath,
    projectName,
    filePath: meta.filePath,
    messageCount: parsed.messageCount,
    toolsUsed: parsed.toolsUsed,
    filesModified: parsed.filesModified,
    errorsEncountered: parsed.errorsEncountered,
    costUsd: parsed.costUsd > 0 ? parsed.costUsd : null,
    startedAt,
    endedAt,
    durationSeconds,
    summary: parsed.summary,
    rawMetadata: parsed.sampleMessages.length > 0
      ? { messages: parsed.sampleMessages }
      : null,
  };
}
