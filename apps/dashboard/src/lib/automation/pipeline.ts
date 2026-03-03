import { db } from "@/lib/db";
import {
  automationRuns,
  claudeSessions,
  contentTriggers,
  insights,
  workspaces,
} from "@sessionforge/db";
import { and, eq, gte, isNull } from "drizzle-orm";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { extractInsight } from "@/lib/ai/agents/insight-extractor";
import { generateContent } from "@/lib/automation/content-generator";
import { fireWebhookEvent } from "@/lib/webhooks/events";

type ContentTrigger = typeof contentTriggers.$inferSelect;
type Workspace = typeof workspaces.$inferSelect;

export function lookbackWindowToDays(window: string): number {
  switch (window) {
    case "current_day":
      return 1;
    case "yesterday":
      return 1;
    case "last_7_days":
      return 7;
    case "last_14_days":
      return 14;
    case "last_30_days":
      return 30;
    case "custom":
      return 7;
    default:
      return 7;
  }
}

export async function executePipeline(
  runId: string,
  trigger: ContentTrigger,
  workspace: Workspace
): Promise<void> {
  const pipelineStart = Date.now();

  try {
    // ── SCAN ──────────────────────────────────────────────────────────────
    await db
      .update(automationRuns)
      .set({ status: "scanning" })
      .where(eq(automationRuns.id, runId));

    const lookbackDays = lookbackWindowToDays(
      trigger.lookbackWindow ?? "last_7_days"
    );
    const basePath = workspace.sessionBasePath ?? "~/.claude";

    const files = await scanSessionFiles(lookbackDays, basePath);

    const normalized = await Promise.all(
      files.map(async (meta) => {
        const parsed = await parseSessionFile(meta.filePath);
        return normalizeSession(meta, parsed);
      })
    );

    const scanResult = await indexSessions(workspace.id, normalized);

    await db
      .update(automationRuns)
      .set({ sessionsScanned: scanResult.scanned })
      .where(eq(automationRuns.id, runId));

    // ── EXTRACT ───────────────────────────────────────────────────────────
    await db
      .update(automationRuns)
      .set({ status: "extracting" })
      .where(eq(automationRuns.id, runId));

    const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Find sessions in the lookback window that have no associated insights
    const sessionsWithoutInsights = await db
      .select({
        id: claudeSessions.id,
        sessionId: claudeSessions.sessionId,
      })
      .from(claudeSessions)
      .leftJoin(insights, eq(insights.sessionId, claudeSessions.id))
      .where(
        and(
          eq(claudeSessions.workspaceId, workspace.id),
          gte(claudeSessions.startedAt, cutoff),
          isNull(insights.id)
        )
      );

    const extractionStartedAt = new Date();
    let insightsExtracted = 0;

    for (const session of sessionsWithoutInsights) {
      try {
        await extractInsight({
          workspaceId: workspace.id,
          sessionId: session.sessionId,
        });
        insightsExtracted++;
      } catch {
        // Partial extraction is acceptable — continue to next session
      }
    }

    await db
      .update(automationRuns)
      .set({ insightsExtracted })
      .where(eq(automationRuns.id, runId));

    // Collect IDs of insights created during this extraction run
    const newInsightsRows = await db
      .select({ id: insights.id })
      .from(insights)
      .where(
        and(
          eq(insights.workspaceId, workspace.id),
          gte(insights.createdAt, extractionStartedAt)
        )
      );

    const newInsightIds = newInsightsRows.map((row) => row.id);

    // ── GENERATE ──────────────────────────────────────────────────────────
    await db
      .update(automationRuns)
      .set({ status: "generating" })
      .where(eq(automationRuns.id, runId));

    // Cast to the content types supported by generateContent
    const contentType = trigger.contentType as
      | "blog_post"
      | "twitter_thread"
      | "linkedin_post"
      | "changelog";

    const generateResult = await generateContent({
      workspaceId: workspace.id,
      contentType,
      insightIds: newInsightIds,
      lookbackDays,
    });

    const completedAt = new Date();
    const durationMs = Date.now() - pipelineStart;

    await db
      .update(automationRuns)
      .set({
        status: "complete",
        postId: generateResult?.postId ?? null,
        completedAt,
        durationMs,
      })
      .where(eq(automationRuns.id, runId));

    await db
      .update(contentTriggers)
      .set({ lastRunAt: completedAt, lastRunStatus: "success" })
      .where(eq(contentTriggers.id, trigger.id));

    void fireWebhookEvent(workspace.id, "automation.completed", {
      runId,
      status: "complete",
      sessionsScanned: scanResult.scanned,
      insightsExtracted,
      postId: generateResult?.postId ?? null,
      durationMs,
    });
  } catch (error) {
    // Extracted insights are preserved in the DB even on failure
    const completedAt = new Date();
    const durationMs = Date.now() - pipelineStart;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await db
      .update(automationRuns)
      .set({
        status: "failed",
        errorMessage,
        completedAt,
        durationMs,
      })
      .where(eq(automationRuns.id, runId));

    await db
      .update(contentTriggers)
      .set({ lastRunAt: completedAt, lastRunStatus: "failed" })
      .where(eq(contentTriggers.id, trigger.id));

    void fireWebhookEvent(workspace.id, "automation.completed", {
      runId,
      status: "failed",
      error: errorMessage,
      durationMs,
    });
  }
}
