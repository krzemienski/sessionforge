import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns, workspaces } from "@sessionforge/db";
import { eq, desc } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

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
}
