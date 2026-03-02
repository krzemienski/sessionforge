import { db } from "@/lib/db";
import { claudeSessions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import type { NormalizedSession } from "./normalizer";

export interface IndexResult {
  scanned: number;
  indexed: number;
  new: number;
  updated: number;
  errors: string[];
}

export async function indexSessions(
  workspaceId: string,
  sessions: NormalizedSession[]
): Promise<IndexResult> {
  const errors: string[] = [];
  let newCount = 0;
  let updatedCount = 0;

  for (const s of sessions) {
    try {
      const existing = await db
        .select({ id: claudeSessions.id })
        .from(claudeSessions)
        .where(
          and(
            eq(claudeSessions.workspaceId, workspaceId),
            eq(claudeSessions.sessionId, s.sessionId)
          )
        )
        .limit(1);

      const values = {
        workspaceId,
        sessionId: s.sessionId,
        projectPath: s.projectPath,
        projectName: s.projectName,
        filePath: s.filePath,
        messageCount: s.messageCount,
        toolsUsed: s.toolsUsed,
        filesModified: s.filesModified,
        errorsEncountered: s.errorsEncountered,
        costUsd: s.costUsd,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationSeconds: s.durationSeconds,
        scannedAt: new Date(),
      };

      if (existing.length > 0) {
        await db
          .update(claudeSessions)
          .set(values)
          .where(eq(claudeSessions.id, existing[0].id));
        updatedCount++;
      } else {
        await db.insert(claudeSessions).values(values);
        newCount++;
      }
    } catch (err) {
      errors.push(
        `Failed to index session ${s.sessionId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    scanned: sessions.length,
    indexed: newCount + updatedCount,
    new: newCount,
    updated: updatedCount,
    errors,
  };
}
