import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { checkQuota, recordUsage } from "@/lib/billing/usage";
import { createPipelineInstrumentation } from "@/lib/observability/instrument-pipeline";
import { analyzeCorpus } from "@/lib/ai/agents/corpus-analyzer";

export const dynamic = "force-dynamic";

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response(sseEvent({ type: "error", message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const searchParams = req.nextUrl.searchParams;
  const lookbackParam = searchParams.get("lookbackDays");
  const parsedDays = lookbackParam !== null ? parseInt(lookbackParam, 10) : NaN;
  const lookbackDays = !isNaN(parsedDays) ? parsedDays : 30;
  const analyzeAfterScan = searchParams.get("analyzeAfterScan") !== "false";
  const workspaceSlug = searchParams.get("workspaceSlug");

  const workspace = workspaceSlug
    ? await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.slug, workspaceSlug))
        .limit(1)
    : await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.ownerId, session.user.id))
        .limit(1);

  if (!workspace.length) {
    return new Response(
      sseEvent({ type: "error", message: "No workspace found" }),
      {
        status: 404,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  const ws = workspace[0];

  const quotaCheck = await checkQuota(session.user.id, "session_scan");
  if (!quotaCheck.allowed) {
    return new Response(
      sseEvent({ type: "error", message: "Quota exceeded. Upgrade your plan to continue scanning." }),
      {
        status: 402,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  const userId = session.user.id;
  const basePath = ws.sessionBasePath ?? "~/.claude";
  const start = Date.now();
  const obs = createPipelineInstrumentation("session-scan", ws.id);

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: unknown) => {
        controller.enqueue(new TextEncoder().encode(sseEvent(data)));
      };

      try {
        obs.start({ lookbackDays, basePath });
        obs.stage("scanning-files");
        const files = await scanSessionFiles(lookbackDays, basePath);
        const total = files.length;

        enqueue({ type: "start", total });

        obs.stage("parsing-sessions", { total });
        const normalized = [];
        for (let i = 0; i < files.length; i++) {
          const meta = files[i];
          obs.progress(i + 1, total, { sessionId: meta.sessionId });
          enqueue({
            type: "progress",
            current: i + 1,
            total,
            sessionId: meta.sessionId,
            projectPath: meta.projectPath,
          });
          const parsed = await parseSessionFile(meta.filePath);
          normalized.push(await normalizeSession(meta, parsed));
        }

        obs.stage("indexing", { count: normalized.length });
        const result = await indexSessions(ws.id, normalized);

        // Record usage for newly indexed sessions (single call, not N parallel)
        if (result.new > 0) {
          void recordUsage(userId, ws.id, "session_scan", undefined, result.new);
        }

        // Update workspace lastScanAt
        await db
          .update(workspaces)
          .set({ lastScanAt: new Date() })
          .where(eq(workspaces.id, ws.id));

        // ── ANALYZE (auto-chain) ──────────────────────────────────────────
        let analysisResult: { insightCount: number } | null = null;

        if (analyzeAfterScan && result.scanned > 0) {
          obs.stage("analyzing");
          enqueue({ type: "analyzing", message: "Analyzing cross-session patterns..." });

          try {
            analysisResult = await analyzeCorpus({
              workspaceId: ws.id,
              lookbackDays,
              traceId: obs.traceId,
            });

            enqueue({
              type: "analysis_complete",
              insightCount: analysisResult.insightCount,
            });
          } catch (analysisErr) {
            // Analysis failure is non-fatal — scan still succeeded
            enqueue({
              type: "analysis_error",
              message: analysisErr instanceof Error ? analysisErr.message : String(analysisErr),
            });
          }
        }

        obs.complete({ scanned: result.scanned, new: result.new, updated: result.updated, errors: result.errors, insightsFound: analysisResult?.insightCount ?? 0 });
        enqueue({
          type: "complete",
          scanned: result.scanned,
          new: result.new,
          updated: result.updated,
          errors: result.errors,
          insightsFound: analysisResult?.insightCount ?? 0,
          durationMs: Date.now() - start,
          traceId: obs.traceId,
        });
      } catch (err) {
        obs.error(err);
        enqueue({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
