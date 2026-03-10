import { db } from "@/lib/db";
import {
  automationRuns,
  claudeSessions,
  contentTriggers,
  insights,
  scanSources,
  workspaces,
} from "@sessionforge/db";
import { and, eq, gte } from "drizzle-orm/sql";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile, parseSessionBuffer } from "@/lib/sessions/parser";
import { normalizeSession, type NormalizedSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { scanRemoteSessions } from "@/lib/sessions/ssh-scanner";
import { analyzeCorpus } from "@/lib/ai/agents/corpus-analyzer";
import { generateContent, type ContentType } from "@/lib/automation/content-generator";
import { fireWebhookEvent } from "@/lib/webhooks/events";
import { createPipelineInstrumentation } from "@/lib/observability/instrument-pipeline";

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
    case "all_time":
      return 36500;
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
  const obs = createPipelineInstrumentation("automation-pipeline", workspace.id);

  try {
    obs.start({ runId, triggerId: trigger.id, contentType: trigger.contentType });

    // ── SCAN ──────────────────────────────────────────────────────────────
    obs.stage("scanning");
    await db
      .update(automationRuns)
      .set({ status: "scanning" })
      .where(eq(automationRuns.id, runId));

    const lookbackDays = lookbackWindowToDays(
      trigger.lookbackWindow ?? "last_7_days"
    );
    const basePath = workspace.sessionBasePath ?? "~/.claude";

    // Pre-fetch already-indexed sessionIds to skip expensive re-parsing
    const existingRows = await db
      .select({ sessionId: claudeSessions.sessionId })
      .from(claudeSessions)
      .where(eq(claudeSessions.workspaceId, workspace.id));
    const indexedIds = new Set(existingRows.map((r) => r.sessionId));

    // Run local file discovery and SSH source query in parallel
    const [localFiles, remoteSrcRows] = await Promise.all([
      scanSessionFiles(lookbackDays, basePath),
      db
        .select()
        .from(scanSources)
        .where(
          and(
            eq(scanSources.workspaceId, workspace.id),
            eq(scanSources.enabled, true)
          )
        ),
    ]);

    // Filter out already-indexed local files before parsing
    const newLocalFiles = localFiles.filter((f) => !indexedIds.has(f.sessionId));
    console.log(
      `[pipeline] Local: ${localFiles.length} found, ${newLocalFiles.length} new (${indexedIds.size} already indexed)`
    );

    // Parse new local files in batches to limit memory pressure
    const normalized: NormalizedSession[] = [];
    const BATCH = 50;
    for (let i = 0; i < newLocalFiles.length; i += BATCH) {
      const batch = newLocalFiles.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (meta) => {
          try {
            const parsed = await parseSessionFile(meta.filePath);
            return normalizeSession(meta, parsed);
          } catch {
            return null;
          }
        })
      );
      for (const r of results) {
        if (r) normalized.push(r);
      }
    }

    // Scan remote SSH sources
    for (const src of remoteSrcRows) {
      try {
        const { meta: remoteMeta, buffers } = await scanRemoteSessions(
          {
            host: src.host,
            port: src.port ?? 22,
            username: src.username,
            encryptedPassword: src.encryptedPassword,
            basePath: src.basePath ?? "~/.claude",
            label: src.label,
          },
          lookbackDays,
          indexedIds,
        );
        for (const m of remoteMeta) {
          const buf = buffers.get(m.filePath);
          if (buf) {
            const parsed = await parseSessionBuffer(buf);
            normalized.push(normalizeSession(m, parsed));
          }
        }
        console.log(
          `[pipeline] SSH ${src.label}: ${remoteMeta.length} new sessions downloaded`
        );
        await db
          .update(scanSources)
          .set({ lastScannedAt: new Date() })
          .where(eq(scanSources.id, src.id));
      } catch (err) {
        console.error(`[pipeline] SSH scan failed for ${src.label} (${src.host}):`, err);
      }
    }

    const scanResult = await indexSessions(workspace.id, normalized);

    await db
      .update(automationRuns)
      .set({ sessionsScanned: scanResult.scanned })
      .where(eq(automationRuns.id, runId));

    // ── EXTRACT (corpus analysis) ──────────────────────────────────────────
    obs.stage("extracting");
    await db
      .update(automationRuns)
      .set({ status: "extracting" })
      .where(eq(automationRuns.id, runId));

    const extractionStartedAt = new Date();
    let insightsExtracted = 0;
    let corpusSummary: string | null = null;

    try {
      const corpusResult = await analyzeCorpus({
        workspaceId: workspace.id,
        lookbackDays,
        traceId: obs.traceId,
      });
      insightsExtracted = corpusResult.insightCount;
      corpusSummary = corpusResult.text;
    } catch (err) {
      console.error("[pipeline] Corpus analysis failed:", err instanceof Error ? err.message : err);
      // Corpus analysis failure is non-fatal — continue to generation
    }

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

    // Use actual DB count as source of truth — tool name matching may miss insights
    if (newInsightIds.length > insightsExtracted) {
      insightsExtracted = newInsightIds.length;
    }

    await db
      .update(automationRuns)
      .set({ insightsExtracted })
      .where(eq(automationRuns.id, runId));

    // ── GENERATE ──────────────────────────────────────────────────────────
    obs.stage("generating", { insightsExtracted, insightIds: newInsightIds.length });
    await db
      .update(automationRuns)
      .set({ status: "generating" })
      .where(eq(automationRuns.id, runId));

    const contentType = trigger.contentType as ContentType;

    const generateResult = await generateContent({
      workspaceId: workspace.id,
      contentType,
      insightIds: newInsightIds,
      lookbackDays,
      corpusSummary: corpusSummary ?? undefined,
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

    obs.complete({ sessionsScanned: scanResult.scanned, insightsExtracted, postId: generateResult?.postId ?? null, durationMs });

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

    obs.error(error);

    void fireWebhookEvent(workspace.id, "automation.completed", {
      runId,
      status: "failed",
      error: errorMessage,
      durationMs,
    });
  }
}
