import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns, contentTriggers, workspaces } from "@sessionforge/db";
import { and, eq, inArray } from "drizzle-orm";
import { executePipeline } from "@/lib/automation/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { triggerId } = body;

  if (!triggerId) {
    return NextResponse.json({ error: "triggerId is required" }, { status: 400 });
  }

  const trigger = await db.query.contentTriggers.findFirst({
    where: eq(contentTriggers.id, triggerId),
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, trigger.workspaceId),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const activeRun = await db.query.automationRuns.findFirst({
    where: and(
      eq(automationRuns.triggerId, triggerId),
      inArray(automationRuns.status, ["pending", "scanning", "extracting", "generating"])
    ),
  });

  if (activeRun) {
    return NextResponse.json(
      { error: "Run already in progress", runId: activeRun.id },
      { status: 409 }
    );
  }

  const [newRun] = await db
    .insert(automationRuns)
    .values({
      triggerId,
      workspaceId: workspace.id,
      status: "pending",
    })
    .returning();

  executePipeline(newRun.id, trigger, workspace);

  return NextResponse.json({ runId: newRun.id, status: "pending" }, { status: 202 });
}
