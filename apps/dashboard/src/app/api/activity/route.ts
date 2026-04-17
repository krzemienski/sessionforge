import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns, agentRuns } from "@sessionforge/db";
import { eq, desc } from "drizzle-orm/sql";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { ActivityEvent } from "@/lib/activity/types";

export const dynamic = "force-dynamic";

export type { ActivityEvent };

function formatDuration(ms: number | null): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.ANALYTICS_READ
    );

    const wsId = workspace.id;

    const [pipelineRows, agentRows] = await Promise.all([
      db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.workspaceId, wsId))
        .orderBy(desc(automationRuns.startedAt))
        .limit(limit),
      db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.workspaceId, wsId))
        .orderBy(desc(agentRuns.startedAt))
        .limit(limit),
    ]);

    const pipelineEvents: ActivityEvent[] = pipelineRows.map((run) => {
      const status = run.status as string;
      const isComplete = status === "complete";
      const isFailed = status === "failed";
      const type = isFailed
        ? "pipeline_failed"
        : isComplete
          ? "pipeline_complete"
          : "pipeline_running";

      const duration = formatDuration(run.durationMs);
      const parts: string[] = [];
      if (run.sessionsScanned > 0)
        parts.push(`${run.sessionsScanned} sessions scanned`);
      if (run.insightsExtracted > 0)
        parts.push(`${run.insightsExtracted} insights extracted`);
      if (duration) parts.push(duration);
      if (isFailed && run.errorMessage)
        parts.push(run.errorMessage.slice(0, 80));

      return {
        id: run.id,
        type,
        title: isFailed
          ? "Pipeline failed"
          : isComplete
            ? "Pipeline completed"
            : `Pipeline ${status}`,
        description: parts.join(" · ") || status,
        timestamp: (run.completedAt ?? run.startedAt).toISOString(),
        metadata: {
          sessionsScanned: run.sessionsScanned,
          insightsExtracted: run.insightsExtracted,
          postId: run.postId,
          durationMs: run.durationMs,
          status,
        },
      };
    });

    const agentEvents: ActivityEvent[] = agentRows.map((run) => {
      const status = run.status as string;
      const isComplete = status === "completed";
      const isFailed = status === "failed";
      const type = isFailed
        ? "agent_failed"
        : isComplete
          ? "agent_complete"
          : "agent_running";

      const agentLabel = (run.agentType as string).replace(/_/g, " ");
      const parts: string[] = [];
      if (isFailed && run.errorMessage)
        parts.push(run.errorMessage.slice(0, 80));
      if (run.attemptCount && run.attemptCount > 1)
        parts.push(`${run.attemptCount} attempts`);

      return {
        id: run.id,
        type,
        title: `Agent: ${agentLabel} ${isFailed ? "failed" : isComplete ? "finished" : status}`,
        description: parts.join(" · ") || status,
        timestamp: (run.completedAt ?? run.startedAt ?? new Date()).toISOString(),
        metadata: {
          agentType: run.agentType,
          status,
          attemptCount: run.attemptCount,
          inputMetadata: run.inputMetadata,
          resultMetadata: run.resultMetadata,
        },
      };
    });

    const events = [...pipelineEvents, ...agentEvents]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);

    return NextResponse.json({ events });
  } catch (error) {
    // Re-throw AppError so withApiHandler pattern catches it properly
    if (error instanceof AppError) throw error;
    console.error("[activity] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
