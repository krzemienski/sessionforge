import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { linkedinIntegrations, workspaces } from "@sessionforge/db";
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

  const integration = await db.query.linkedinIntegrations.findFirst({
    where: eq(linkedinIntegrations.workspaceId, workspace.id),
    columns: {
      id: true,
      username: true,
      linkedinUserId: true,
      enabled: true,
      lastSyncAt: true,
      createdAt: true,
    },
  });

  if (!integration) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    username: integration.username,
    linkedinUserId: integration.linkedinUserId,
    enabled: integration.enabled,
    lastSyncAt: integration.lastSyncAt,
    connectedAt: integration.createdAt,
  });
}

export async function DELETE(request: Request) {
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

  const existing = await db.query.linkedinIntegrations.findFirst({
    where: eq(linkedinIntegrations.workspaceId, workspace.id),
  });

  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  await db
    .delete(linkedinIntegrations)
    .where(eq(linkedinIntegrations.workspaceId, workspace.id));

  return NextResponse.json({ disconnected: true });
}
