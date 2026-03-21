/**
 * Session file scanner for discovering Claude session JSONL files on disk.
 * Walks the ~/.claude directory hierarchy to locate session files within a
 * rolling lookback window, returning lightweight metadata for each file found.
 */

import fs from "fs/promises";
import fsSync from "fs";
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
 * Claude encodes paths by replacing `/` with `-` and `.` with `-`, making
 * the encoding lossy: `--` unambiguously means `/.` (dot-prefixed dir),
 * but single `-` is ambiguous between `/` separator and literal hyphen.
 *
 * We handle known OS prefixes first, then greedily resolve each remaining
 * `-` by checking whether the path-so-far exists on disk when interpreted
 * as `/` or kept as `-`. When neither interpretation exists on disk (e.g.
 * non-existent or deleted projects), we default to `/` which produces the
 * most likely original path structure.
 *
 * @param encoded - The encoded directory name as found under `~/.claude/projects/`.
 * @returns The decoded absolute filesystem path.
 */
export function decodeProjectPath(encoded: string): string {
  // Step 1: Handle -- as /. (dot-prefixed dirs like .claude, .zenflow)
  let working = encoded.replace(/--/g, '/.');

  // Step 2: Handle known OS path prefixes
  if (working.startsWith('-Users-')) {
    working = '/Users/' + working.slice(7);
  } else if (working.startsWith('-home-')) {
    working = '/home/' + working.slice(6);
  } else if (working.startsWith('-')) {
    working = '/' + working.slice(1);
  }

  // Step 3: For each remaining `-`, check if interpreting it as `/` yields
  // a real directory. If so, use `/`; otherwise keep the literal `-`.
  // When neither exists on disk, default to `/`.
  const segments = working.split('-');
  let resolved = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const withSlash = resolved + '/' + segments[i];
    const withDash = resolved + '-' + segments[i];

    // Prefer `/` if that directory exists on disk
    try {
      if (
        fsSync.existsSync(withSlash) &&
        fsSync.statSync(withSlash).isDirectory()
      ) {
        resolved = withSlash;
        continue;
      }
    } catch {
      // stat failed — fall through
    }

    // Prefer `-` if that directory exists on disk
    try {
      if (
        fsSync.existsSync(withDash) &&
        fsSync.statSync(withDash).isDirectory()
      ) {
        resolved = withDash;
        continue;
      }
    } catch {
      // stat failed — fall through
    }

    // Neither exists — default to `/` (most likely for project paths)
    resolved = withSlash;
  }

  return resolved;
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
    const projectDir = path.join(projectsDir, encodedProject);

    // Claude Code stores JSONL files directly in the project directory
    const directFiles = await globJsonl(projectDir);
    // Also check a sessions/ subdirectory for forward-compatibility
    const sessionsDir = path.join(projectDir, "sessions");
    const sessionsFiles = await globJsonl(sessionsDir);
    const files = [...directFiles, ...sessionsFiles];

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
