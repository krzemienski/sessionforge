import path from "path";
import type { SessionFileMeta } from "./scanner";
import type { ParsedSession } from "./parser";

export interface NormalizedSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  filePath: string;
  messageCount: number;
  toolsUsed: string[];
  filesModified: string[];
  errorsEncountered: string[];
  costUsd: number | null;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
}

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
  };
}
