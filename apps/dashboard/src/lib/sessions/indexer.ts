/**
 * Session indexer that upserts normalised session records into the database.
 * For each session, checks whether a row already exists for the workspace/session
 * pair and either updates it or inserts a new one, then returns a summary of
 * how many sessions were processed and which failed.
 */

import { db } from "@/lib/db";
import { claudeSessions } from "@sessionforge/db";
import { eq, and, inArray, sql } from "drizzle-orm/sql";
import type { NormalizedSession } from "./normalizer";

/** Postgres EXCLUDED reference for a column in an ON CONFLICT DO UPDATE clause. */
const sqlExcluded = (col: string) => sql.raw(`EXCLUDED.${col}`);

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

  if (sessions.length === 0) {
    return { scanned: 0, indexed: 0, new: 0, updated: 0, errors };
  }

  // Pre-count which sessions already exist so we can report accurate new/updated
  // splits without a per-row pre-check. Uses the same unique index the upsert
  // targets (sessions_workspace_sessionId_uidx).
  const sessionIds = sessions.map((s) => s.sessionId);
  let existingIds = new Set<string>();
  try {
    const rows = await db
      .select({ sessionId: claudeSessions.sessionId })
      .from(claudeSessions)
      .where(
        and(
          eq(claudeSessions.workspaceId, workspaceId),
          inArray(claudeSessions.sessionId, sessionIds)
        )
      );
    existingIds = new Set(rows.map((r) => r.sessionId));
  } catch (err) {
    errors.push(
      `Failed to pre-check existing sessions: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const scannedAt = new Date();
  const values = sessions.map((s) => ({
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
    scannedAt,
  }));

  // Chunk to avoid exceeding Postgres parameter limits (65,535 per statement).
  // With 17 columns per row, CHUNK_SIZE * 17 must stay under 65,535.
  const CHUNK_SIZE = 500;
  let indexed = 0;
  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    const chunk = values.slice(i, i + CHUNK_SIZE);
    try {
      await db
        .insert(claudeSessions)
        .values(chunk)
        .onConflictDoUpdate({
          target: [claudeSessions.workspaceId, claudeSessions.sessionId],
          set: {
            projectPath: sqlExcluded("project_path"),
            projectName: sqlExcluded("project_name"),
            filePath: sqlExcluded("file_path"),
            messageCount: sqlExcluded("message_count"),
            toolsUsed: sqlExcluded("tools_used"),
            filesModified: sqlExcluded("files_modified"),
            errorsEncountered: sqlExcluded("errors_encountered"),
            costUsd: sqlExcluded("cost_usd"),
            startedAt: sqlExcluded("started_at"),
            endedAt: sqlExcluded("ended_at"),
            durationSeconds: sqlExcluded("duration_seconds"),
            summary: sqlExcluded("summary"),
            rawMetadata: sqlExcluded("raw_metadata"),
            scannedAt: sqlExcluded("scanned_at"),
          },
        });
      indexed += chunk.length;
    } catch (err) {
      errors.push(
        `Batch upsert failed for ${chunk.length} sessions (chunk ${i / CHUNK_SIZE}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const newCount = sessions.filter((s) => !existingIds.has(s.sessionId)).length;
  const updatedCount = indexed - newCount;

  return {
    scanned: sessions.length,
    indexed,
    new: newCount,
    updated: Math.max(0, updatedCount),
    errors,
  };
}
