/**
 * Pipeline orchestration for automation runs.
 * Coordinates session scanning, corpus analysis (insight extraction),
 * and content generation into a unified workflow.
 *
 * Flow: Scan sessions → Extract corpus insights → Generate content
 */

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

/**
 * Event emitted by the pipeline during execution.
 * @property {string} stage - Current pipeline stage: scanning, extracting, generating, complete, or failed.
 * @property {string} message - Human-readable status message for the current stage.
 * @property {Record<string, unknown>} [data] - Optional metadata about the stage (scanned count, insights created, etc.).
 */
export interface PipelineEvent {
  stage: "scanning" | "extracting" | "generating" | "complete" | "failed";
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Options for running the automation pipeline.
 * @property {string} runId - Unique identifier for this pipeline run.
 * @property {ContentTrigger} [trigger] - The trigger that initiated this run (if any).
 * @property {Workspace} workspace - The workspace owning the sessions and insights.
 * @property {number} [lookbackDays] - How many days to scan for sessions (default: inferred from trigger).
 * @property {(event: PipelineEvent) => void} [onProgress] - Callback for progress updates during execution.
 */
export interface ExecutePipelineOptions {
  runId: string;
  trigger?: ContentTrigger;
  workspace: Workspace;
  lookbackDays?: number;
  onProgress?: (event: PipelineEvent) => void;
}

/**
 * Converts a lookback window string to number of days.
 * @param {string} window - Lookback window identifier (e.g., "last_7_days", "all_time").
 * @returns {number} Number of days for the window.
 */
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
    case "last_90_days":
      return 90;
    case "all_time":
      return 36500;
    case "custom":
      return 7;
    default:
      return 7;
  }
}

/**
 * Orchestrates the full automation pipeline: scan → extract → generate.
 *
 * Scans local and SSH-configured session sources, analyzes patterns via corpus-analyzer agent,
 * and generates content from extracted insights. Progress updates are emitted via onProgress callback.
 * Extracted insights are persisted in the database and preserved even if generation fails.
 *
 * Supports both options-based and legacy 3-argument signatures for backward compatibility.
 *
 * @param runIdOrOpts - Either ExecutePipelineOptions object or runId string (legacy).
 * @param trigger - (Legacy) The trigger initiating the run.
 * @param workspace - (Legacy) The workspace context.
 * @throws {Error} If session parsing, corpus analysis, or content generation fails.
 * @example
 * // Options-based (recommended)
 * await executePipeline({
 *   runId: "run_123",
 *   workspace,
 *   lookbackDays: 30,
 *   onProgress: (event) => console.log(event.message)
 * });
 *
 * // Legacy 3-arg signature
 * await executePipeline("run_123", trigger, workspace);
 */
export async function executePipeline(
  opts: ExecutePipelineOptions
): Promise<void>;
export async function executePipeline(
  runId: string,
  trigger: ContentTrigger,
  workspace: Workspace
): Promise<void>;
export async function executePipeline(
  runIdOrOpts: string | ExecutePipelineOptions,
  trigger?: ContentTrigger,
  workspace?: Workspace
): Promise<void> {
  // Normalize arguments — support both old 3-arg and new options signatures
  const opts: ExecutePipelineOptions =
    typeof runIdOrOpts === "string"
      ? { runId: runIdOrOpts, trigger: trigger!, workspace: workspace! }
      : runIdOrOpts;

  const { runId, onProgress } = opts;
  const ws = opts.workspace;
  const trig = opts.trigger;

  const emit = (event: PipelineEvent) => {
    onProgress?.(event);
  };

  const pipelineStart = Date.now();
  const obs = createPipelineInstrumentation("automation-pipeline", ws.id);

  try {
    obs.start({ runId, triggerId: trig?.id ?? null, contentType: trig?.contentType ?? "blog_post" });

    // ── SCAN ──────────────────────────────────────────────────────────────
    obs.stage("scanning");
    await db
      .update(automationRuns)
      .set({ status: "scanning" })
      .where(eq(automationRuns.id, runId));

    const lookbackDays = opts.lookbackDays ?? lookbackWindowToDays(
      trig?.lookbackWindow ?? "last_90_days"
    );

    emit({ stage: "scanning", message: `Scanning sessions from last ${lookbackDays} days...` });
    const basePath = ws.sessionBasePath ?? "~/.claude";

    // Pre-fetch already-indexed sessionIds to skip expensive re-parsing
    const existingRows = await db
      .select({ sessionId: claudeSessions.sessionId })
      .from(claudeSessions)
      .where(eq(claudeSessions.workspaceId, ws.id));
    const indexedIds = new Set(existingRows.map((r) => r.sessionId));

    // Run local file discovery and SSH source query in parallel
    const [localFiles, remoteSrcRows] = await Promise.all([
      scanSessionFiles(lookbackDays, basePath),
      db
        .select()
        .from(scanSources)
        .where(
          and(
            eq(scanSources.workspaceId, ws.id),
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

    const scanResult = await indexSessions(ws.id, normalized);

    emit({
      stage: "scanning",
      message: `Found ${scanResult.scanned} sessions (${newLocalFiles.length} local, ${normalized.length - newLocalFiles.length} remote)`,
      data: { scanned: scanResult.scanned },
    });

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

    emit({ stage: "extracting", message: "Analyzing session corpus for patterns..." });

    const extractionStartedAt = new Date();
    let insightsExtracted = 0;
    let corpusSummary: string | null = null;

    try {
      const corpusResult = await analyzeCorpus({
        workspaceId: ws.id,
        lookbackDays,
        traceId: obs.traceId,
      });
      insightsExtracted = corpusResult.insightCount;
      corpusSummary = corpusResult.text;
    } catch (err) {
      console.error("[pipeline] Corpus analysis failed:", err instanceof Error ? err.message : err);
      emit({ stage: "extracting", message: "Corpus analysis failed — continuing to generation" });
    }

    // Collect IDs of insights created during this extraction run
    const newInsightsRows = await db
      .select({ id: insights.id })
      .from(insights)
      .where(
        and(
          eq(insights.workspaceId, ws.id),
          gte(insights.createdAt, extractionStartedAt)
        )
      );

    const newInsightIds = newInsightsRows.map((row) => row.id);

    // Use actual DB count as source of truth — tool name matching may miss insights
    if (newInsightIds.length > insightsExtracted) {
      insightsExtracted = newInsightIds.length;
    }

    emit({
      stage: "extracting",
      message: `Created ${insightsExtracted} insights from corpus analysis`,
      data: { insightsExtracted },
    });

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

    const contentType = (trig?.contentType ?? "blog_post") as ContentType;

    emit({ stage: "generating", message: `Generating ${contentType} from ${insightsExtracted} insights...` });

    const generateResult = await generateContent({
      workspaceId: ws.id,
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

    // Update trigger status if this was a trigger-initiated run
    if (trig) {
      await db
        .update(contentTriggers)
        .set({ lastRunAt: completedAt, lastRunStatus: "success" })
        .where(eq(contentTriggers.id, trig.id));
    }

    obs.complete({ sessionsScanned: scanResult.scanned, insightsExtracted, postId: generateResult?.postId ?? null, durationMs });

    emit({
      stage: "complete",
      message: `Pipeline complete: ${scanResult.scanned} sessions → ${insightsExtracted} insights`,
      data: { sessionsScanned: scanResult.scanned, insightsExtracted, durationMs, postId: generateResult?.postId ?? null },
    });

    void fireWebhookEvent(ws.id, "automation.completed", {
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

    if (trig) {
      await db
        .update(contentTriggers)
        .set({ lastRunAt: completedAt, lastRunStatus: "failed" })
        .where(eq(contentTriggers.id, trig.id));
    }

    obs.error(error);

    emit({
      stage: "failed",
      message: `Pipeline failed: ${errorMessage}`,
      data: { error: errorMessage, durationMs },
    });

    void fireWebhookEvent(ws.id, "automation.completed", {
      runId,
      status: "failed",
      error: errorMessage,
      durationMs,
    });
  }
}
