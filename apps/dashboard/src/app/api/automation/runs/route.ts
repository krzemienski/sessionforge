import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns } from "@sessionforge/db";
import { eq, desc } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_READ
    );

    const rawRuns = await db.query.automationRuns.findMany({
      where: eq(automationRuns.workspaceId, workspace.id),
      with: { trigger: true },
      orderBy: [desc(automationRuns.startedAt)],
      limit: 50,
    });

    const runs = rawRuns.map(({ trigger, ...run }) => ({
      id: run.id,
      triggerId: run.triggerId,
      triggerName: trigger?.name ?? null,
      status: run.status,
      sessionsScanned: run.sessionsScanned,
      insightsExtracted: run.insightsExtracted,
      postId: run.postId,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
    }));

    return NextResponse.json({ runs });
  })(request);
}
