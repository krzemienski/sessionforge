import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";

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

  const triggers = await db.query.contentTriggers.findMany({
    where: eq(contentTriggers.workspaceId, workspace.id),
  });

  return NextResponse.json({ triggers });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, name, triggerType, contentType, lookbackWindow, cronExpression } = body;

  if (!workspaceSlug || !triggerType || !contentType) {
    return NextResponse.json(
      { error: "workspaceSlug, triggerType, and contentType are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [trigger] = await db
    .insert(contentTriggers)
    .values({
      workspaceId: workspace.id,
      name: name || "Untitled Schedule",
      triggerType,
      contentType,
      lookbackWindow: lookbackWindow || "last_7_days",
      cronExpression: cronExpression || null,
    })
    .returning();

  return NextResponse.json(trigger, { status: 201 });
}
