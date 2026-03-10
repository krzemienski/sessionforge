/**
 * Pipeline analysis API endpoint.
 * Provides Server-Sent Events (SSE) streaming of pipeline progress for manual analysis runs.
 *
 * POST /api/pipeline/analyze
 * - Creates a new automation run with source="manual"
 * - Streams progress events as they occur (scanning → extracting → generating)
 * - Returns SSE stream with PipelineEvent objects
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns, workspaces } from "@sessionforge/db";
import { and, eq, inArray } from "drizzle-orm/sql";
import { ERROR_CODES } from "@/lib/errors";
import {
  executePipeline,
  type PipelineEvent,
} from "@/lib/automation/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/pipeline/analyze
 *
 * Initiates a manual pipeline run and streams progress events via SSE.
 *
 * @param request - HTTP request with JSON body.
 * @body {string} workspaceSlug - Required. Workspace slug to analyze.
 * @body {number} [lookbackDays] - Optional. Number of days to scan (default: 90).
 *
 * @returns {Response} SSE stream with PipelineEvent objects.
 *
 * @example
 * const response = await fetch("/api/pipeline/analyze", {
 *   method: "POST",
 *   body: JSON.stringify({ workspaceSlug: "my-workspace", lookbackDays: 30 })
 * });
 * const reader = response.body.getReader();
 * // Read SSE data: { stage, message, data, runId }
 *
 * Error responses:
 * - 401 Unauthorized: No session
 * - 400 Bad Request: Missing workspaceSlug
 * - 404 Not Found: Workspace not found
 * - 409 Conflict: Analysis already in progress for this workspace
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", code: ERROR_CODES.UNAUTHORIZED },
      { status: 401 }
    );
  }

  const body = (await request.json()) as {
    workspaceSlug?: string;
    lookbackDays?: number;
  };

  const workspaceSlug = body.workspaceSlug;
  if (!workspaceSlug) {
    return NextResponse.json(
      { error: "workspaceSlug is required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found", code: ERROR_CODES.NOT_FOUND },
      { status: 404 }
    );
  }

  // Check for already-running pipeline in this workspace
  const activeRun = await db.query.automationRuns.findFirst({
    where: and(
      eq(automationRuns.workspaceId, workspace.id),
      inArray(automationRuns.status, [
        "pending",
        "scanning",
        "extracting",
        "generating",
      ])
    ),
  });

  if (activeRun) {
    return NextResponse.json(
      { error: "Analysis already in progress", runId: activeRun.id },
      { status: 409 }
    );
  }

  const lookbackDays = body.lookbackDays ?? 90;

  // Create run record — no trigger required (manual source)
  const [newRun] = await db
    .insert(automationRuns)
    .values({
      workspaceId: workspace.id,
      source: "manual",
      status: "pending",
    })
    .returning();

  // Stream progress events via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: PipelineEvent) => {
        const data = JSON.stringify({ ...event, runId: newRun.id });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      send({ stage: "scanning", message: "Pipeline started" });

      executePipeline({
        runId: newRun.id,
        workspace,
        lookbackDays,
        onProgress: send,
      })
        .then(() => {
          controller.close();
        })
        .catch((err) => {
          const msg =
            err instanceof Error ? err.message : String(err);
          send({ stage: "failed", message: msg });
          controller.close();
        });
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
