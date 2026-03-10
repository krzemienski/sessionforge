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
