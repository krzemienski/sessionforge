/**
 * Session indexer that upserts normalised session records into the database.
 * For each session, checks whether a row already exists for the workspace/session
 * pair and either updates it or inserts a new one, then returns a summary of
 * how many sessions were processed and which failed.
 */

import { db } from "@/lib/db";
import { claudeSessions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import type { NormalizedSession } from "./normalizer";

/** Summary of a completed indexing run. */
export interface IndexResult {
  /** Total number of sessions passed to the indexer. */
  scanned: number;
  /** Number of sessions successfully inserted or updated in the database. */
  indexed: number;
  /** Number of newly inserted sessions. */
  new: number;
  /** Number of updated (existing) sessions. */
  updated: number;
  /** Human-readable error messages for any sessions that failed to index. */
  errors: string[];
}

/**
 * Upserts a batch of normalised sessions into the `claudeSessions` table.
 *
 * For each session in `sessions`, the function:
 * 1. Queries for an existing row matching the `workspaceId` + `sessionId` pair.
 * 2. Updates the existing row if found, or inserts a new one otherwise.
 * 3. Stamps `scannedAt` with the current time on every write.
 *
 * Individual session failures are caught and recorded in `errors` so that a
 * single bad record does not abort the entire batch.
 *
 * @param workspaceId - The workspace that owns all sessions in this batch.
 * @param sessions - Normalised session records to persist.
 * @returns An {@link IndexResult} summarising the outcome of the indexing run.
 */
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
        summary: s.summary,
        rawMetadata: s.rawMetadata,
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
