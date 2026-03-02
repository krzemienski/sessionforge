/**
 * Session file scanner for discovering Claude session JSONL files on disk.
 * Walks the ~/.claude directory hierarchy to locate session files within a
 * rolling lookback window, returning lightweight metadata for each file found.
 */

import fs from "fs/promises";
import { type Dirent } from "fs";
import path from "path";
import os from "os";

/** Lightweight metadata describing a discovered Claude session file. */
export interface SessionFileMeta {
  /** Absolute path to the JSONL file on disk. */
  filePath: string;
  /** UUID-style session identifier derived from the filename (without extension). */
  sessionId: string;
  /** Decoded project root path associated with this session. */
  projectPath: string;
  /** Last-modified time of the JSONL file, used for lookback filtering. */
  mtime: Date;
}

/**
 * Converts a Claude-encoded project directory name back to a filesystem path.
 *
 * Claude stores project paths as directory names where the leading `/` is
 * replaced by `-` and all subsequent `/` separators are also `-`.
 * For example, `-Users-nick-projects-my-app` decodes to `/Users/nick/projects/my-app`.
 *
 * @param encoded - The encoded directory name as found under `~/.claude/projects/`.
 * @returns The decoded absolute filesystem path.
 */
function decodeProjectPath(encoded: string): string {
  // e.g. "-Users-nick-projects-my-app" → "/Users/nick/projects/my-app"
  return encoded.replace(/^-/, "/").replace(/-/g, "/");
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
 * Discovers all Claude session JSONL files modified within the lookback window.
 *
 * Searches two locations inside the Claude base directory:
 * - `projects/<encoded-path>/sessions/*.jsonl` — per-project sessions
 * - `sessions/*.jsonl` — global (project-agnostic) sessions
 *
 * Files older than `lookbackDays` days are excluded. Unreadable files and
 * directories that do not yet exist are silently skipped.
 *
 * @param lookbackDays - Number of days to look back from now (default: 30).
 * @param basePath - Root of the Claude data directory (default: `~/.claude`).
 * @returns An array of {@link SessionFileMeta} objects, one per qualifying file.
 */
export async function scanSessionFiles(
  lookbackDays = 30,
  basePath = "~/.claude",
  sinceTimestamp?: Date
): Promise<SessionFileMeta[]> {
  const resolvedBase = basePath.startsWith("~")
    ? path.join(os.homedir(), basePath.slice(1))
    : basePath;

  const cutoff =
    sinceTimestamp ?? new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const results: SessionFileMeta[] = [];

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
    const encodedProject = entry.name;
    const projectPath = decodeProjectPath(encodedProject);
    const sessionsDir = path.join(projectsDir, encodedProject, "sessions");
    const files = await globJsonl(sessionsDir);
    for (const filePath of files) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.mtime < cutoff) continue;
        const sessionId = path.basename(filePath, ".jsonl");
        results.push({ filePath, sessionId, projectPath, mtime: stat.mtime });
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
      if (stat.mtime < cutoff) continue;
      const sessionId = path.basename(filePath, ".jsonl");
      results.push({
        filePath,
        sessionId,
        projectPath: resolvedBase,
        mtime: stat.mtime,
      });
    } catch {
      // skip unreadable files
    }
  }

  return results;
}
