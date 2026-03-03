/**
 * File watcher utility for detecting changes in Claude session JSONL files.
 * Provides fingerprinting, change detection, and debounce checking functions
 * for the file-watch automation trigger.
 *
 * Designed to be called from a polling endpoint (e.g. every 5 minutes via
 * QStash) rather than using a long-lived fs.watch listener, making it
 * compatible with serverless environments.
 */

import fs from "fs/promises";
import { type Dirent } from "fs";
import path from "path";
import os from "os";

/**
 * A fingerprint mapping absolute file paths to their last-modified timestamps
 * in milliseconds. Used to detect new or modified session files between polls.
 */
export type SessionFingerprint = Record<string, number>;

/**
 * The result of comparing two session fingerprints.
 */
export interface SessionChanges {
  /** File paths that are new in the current fingerprint (not present in prev). */
  added: string[];
  /** File paths whose mtime has changed since the previous fingerprint. */
  modified: string[];
  /** Convenience flag: true when `added` or `modified` is non-empty. */
  hasChanges: boolean;
}

/**
 * Returns the paths of all `.jsonl` files directly inside `dir`.
 * Silently returns an empty array if the directory does not exist or cannot be read.
 *
 * @param dir - Directory to scan for JSONL files.
 * @returns A list of absolute file paths ending in `.jsonl`.
 */
async function globJsonl(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

/**
 * Builds a fingerprint of all Claude session JSONL files under `basePath`.
 *
 * Scans two locations inside the Claude base directory:
 * - `projects/<encoded-path>/sessions/*.jsonl` — per-project sessions
 * - `sessions/*.jsonl` — global (project-agnostic) sessions
 *
 * Unreadable files and directories that do not yet exist are silently skipped.
 *
 * @param basePath - Root of the Claude data directory (e.g. `~/.claude`).
 * @returns A map of absolute file path → last-modified time in milliseconds.
 */
export async function getSessionFingerprint(
  basePath: string
): Promise<SessionFingerprint> {
  const resolvedBase = basePath.startsWith("~")
    ? path.join(os.homedir(), basePath.slice(1))
    : basePath;

  const fingerprint: SessionFingerprint = {};

  // ~/.claude/projects/*/sessions/*.jsonl
  const projectsDir = path.join(resolvedBase, "projects");
  let projectEntries: Dirent[] = [];
  try {
    projectEntries = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch {
    // directory may not exist
  }

  for (const entry of projectEntries) {
    if (!entry.isDirectory()) continue;
    const sessionsDir = path.join(projectsDir, entry.name, "sessions");
    const files = await globJsonl(sessionsDir);
    for (const filePath of files) {
      try {
        const stat = await fs.stat(filePath);
        fingerprint[filePath] = stat.mtimeMs;
      } catch {
        // skip unreadable files
      }
    }
  }

  // ~/.claude/sessions/*.jsonl (global sessions)
  const globalSessionsDir = path.join(resolvedBase, "sessions");
  const globalFiles = await globJsonl(globalSessionsDir);
  for (const filePath of globalFiles) {
    try {
      const stat = await fs.stat(filePath);
      fingerprint[filePath] = stat.mtimeMs;
    } catch {
      // skip unreadable files
    }
  }

  return fingerprint;
}

/**
 * Compares two session fingerprints to identify new or modified files.
 *
 * A file is considered "added" if it appears in `curr` but not in `prev`.
 * A file is considered "modified" if it appears in both fingerprints but with
 * a different mtime value.
 *
 * Deleted files (present in `prev` but absent from `curr`) are intentionally
 * ignored — removal of a session file is not a signal to fire the pipeline.
 *
 * @param prev - The previously stored fingerprint (may be empty on first run).
 * @param curr - The freshly computed fingerprint.
 * @returns A {@link SessionChanges} object describing the differences.
 */
export function detectSessionChanges(
  prev: SessionFingerprint,
  curr: SessionFingerprint
): SessionChanges {
  const added: string[] = [];
  const modified: string[] = [];

  for (const [filePath, mtimeMs] of Object.entries(curr)) {
    if (!(filePath in prev)) {
      added.push(filePath);
    } else if (prev[filePath] !== mtimeMs) {
      modified.push(filePath);
    }
  }

  return {
    added,
    modified,
    hasChanges: added.length > 0 || modified.length > 0,
  };
}

/**
 * Determines whether the automation pipeline should fire given the debounce state.
 *
 * Returns `true` when at least `debounceMinutes` minutes have elapsed since the
 * most recent detected file change. This prevents the pipeline from triggering
 * while a coding session is still active — only once the developer has been
 * idle for the full debounce window will the pipeline fire.
 *
 * Returns `false` when `lastFileEventAt` is `null` (no file change has ever
 * been recorded for this trigger), as there is nothing new to process.
 *
 * @param lastFileEventAt - Timestamp of the most recent detected file change, or `null`.
 * @param debounceMinutes - Number of quiet minutes required before the pipeline fires.
 * @returns `true` if the pipeline should fire now, `false` otherwise.
 */
export function shouldFirePipeline(
  lastFileEventAt: Date | null,
  debounceMinutes: number
): boolean {
  if (lastFileEventAt === null) {
    return false;
  }

  const elapsedMs = Date.now() - lastFileEventAt.getTime();
  const debounceMs = debounceMinutes * 60 * 1000;
  return elapsedMs >= debounceMs;
}
