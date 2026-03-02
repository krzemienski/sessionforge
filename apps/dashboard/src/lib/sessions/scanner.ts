import fs from "fs/promises";
import { type Dirent } from "fs";
import path from "path";
import os from "os";

export interface SessionFileMeta {
  filePath: string;
  sessionId: string;
  projectPath: string;
  mtime: Date;
}

function decodeProjectPath(encoded: string): string {
  // e.g. "-Users-nick-projects-my-app" → "/Users/nick/projects/my-app"
  return encoded.replace(/^-/, "/").replace(/-/g, "/");
}

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
