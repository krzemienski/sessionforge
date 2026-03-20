/**
 * POST /api/content/ingest
 *
 * Ingestion pipeline for external source material.
 * Accepts URLs, git repos, and free-form text; extracts structured content
 * and returns a SourceMaterialPackage via SSE streaming.
 *
 * Input:
 *   { workspaceSlug, topic, userText?, urls?: string[], repoUrls?: string[] }
 *
 * SSE events: status, result, error, done
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createSSEStream, sseResponse } from "@/lib/ai/orchestration/streaming";
import { extractURL } from "@/lib/ingestion/url-extractor";
import { analyzeRepoWithTimeout } from "@/lib/ingestion/repo-analyzer";
import { processUserText } from "@/lib/ingestion/text-processor";
import { assembleSourceMaterial } from "@/lib/ingestion/source-assembler";
import { SessionMiner } from "@/lib/sessions/miner";
import { classifyEvidence, toSessionEvidence } from "@/lib/sessions/evidence-classifier";

export const dynamic = "force-dynamic";

const ingestSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  topic: z.string().min(1, "topic is required"),
  userText: z.string().optional(),
  urls: z.array(z.string().url()).max(10).optional().default([]),
  repoUrls: z.array(z.string().url()).max(5).optional().default([]),
});

export async function POST(request: Request): Promise<Response> {
  // Auth check before starting the stream
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized", code: ERROR_CODES.UNAUTHORIZED }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body", code: ERROR_CODES.BAD_REQUEST }, { status: 400 });
  }

  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return Response.json(
      { error: "Validation failed", code: ERROR_CODES.VALIDATION_ERROR, details: { fields } },
      { status: 400 }
    );
  }

  const { workspaceSlug, topic, userText, urls, repoUrls } = parsed.data;

  let workspace: { id: string };
  try {
    const result = await getAuthorizedWorkspace(session, workspaceSlug, PERMISSIONS.CONTENT_CREATE);
    workspace = result.workspace;
  } catch {
    return Response.json({ error: "Workspace not found", code: ERROR_CODES.NOT_FOUND }, { status: 404 });
  }

  // Start SSE stream
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      send("status", { phase: "starting", message: "Starting ingestion pipeline..." });

      // --- Phase 1: Parallel extraction ---
      const totalSources = (urls?.length ?? 0) + (repoUrls?.length ?? 0) + (userText ? 1 : 0);
      send("status", { phase: "extracting", message: `Extracting ${totalSources} source(s)...` });

      // Run all extractions in parallel; use Promise.allSettled so one failure
      // doesn't kill the whole pipeline.
      const [userBriefResult, urlResults, repoResults, miningResult] = await Promise.all([
        // User text processing
        userText
          ? Promise.allSettled([processUserText(userText)])
          : Promise.resolve([]),

        // URL extraction (parallel per URL)
        Promise.allSettled((urls ?? []).map((url) => extractURL(url))),

        // Repo analysis (parallel per repo)
        Promise.allSettled((repoUrls ?? []).map((url) => analyzeRepoWithTimeout(url))),

        // Session mining — search indexed sessions for topic-related evidence
        Promise.allSettled([
          (async () => {
            send("status", { phase: "mining", message: "Mining sessions for evidence..." });
            const miner = new SessionMiner(workspace.id);
            await miner.buildIndex();
            const hits = await miner.search(topic, 20);
            const evidence = await classifyEvidence(hits, topic);
            send("status", { phase: "mining", message: `Found ${evidence.length} evidence item(s) from sessions.` });
            return evidence;
          })(),
        ]),
      ]);

      // Extract userBrief
      const userBrief =
        Array.isArray(userBriefResult) &&
        userBriefResult[0]?.status === "fulfilled"
          ? userBriefResult[0].value
          : null;

      // Extract successful URL results (failed ones already have fallback data from extractURL)
      const externalSources = urlResults
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((v): v is NonNullable<typeof v> => v !== null);

      // Extract successful repo results
      const repositories = repoResults
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((v): v is NonNullable<typeof v> => v !== null);

      // Extract session evidence (non-fatal — falls back to empty array)
      const sessionEvidence =
        Array.isArray(miningResult) &&
        miningResult[0]?.status === "fulfilled"
          ? miningResult[0].value
          : [];

      // Log any extraction failures
      urlResults.forEach((r, i) => {
        if (r.status === "rejected") {
          send("status", { phase: "warning", message: `URL extraction failed for source ${i + 1}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}` });
        }
      });
      repoResults.forEach((r, i) => {
        if (r.status === "rejected") {
          send("status", { phase: "warning", message: `Repo analysis failed for repo ${i + 1}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}` });
        }
      });
      if (
        Array.isArray(miningResult) &&
        miningResult[0]?.status === "rejected"
      ) {
        const reason = miningResult[0].reason;
        send("status", {
          phase: "warning",
          message: `Session mining failed: ${reason instanceof Error ? reason.message : String(reason)}`,
        });
      }

      send("status", {
        phase: "assembling",
        message: `Assembling ${externalSources.length} URLs, ${repositories.length} repos, ${sessionEvidence.length} evidence items...`,
      });

      // --- Phase 2: Assemble source material package ---
      const sourceMaterialPackage = await assembleSourceMaterial({
        userBrief,
        externalSources,
        repositories,
        sessionEvidence: toSessionEvidence(sessionEvidence),
      });

      send("result", sourceMaterialPackage);
      send("status", { phase: "complete", message: "Ingestion complete." });
    } catch (error) {
      const errorMsg = error instanceof AppError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
      send("error", { message: errorMsg });
    } finally {
      close();
    }
  };

  run();
  return sseResponse(stream);
}
