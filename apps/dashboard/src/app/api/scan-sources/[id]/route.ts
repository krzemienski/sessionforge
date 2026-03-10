import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanSources, workspaces } from "@sessionforge/db";
import { and, eq } from "drizzle-orm/sql";
import { encryptPassword } from "@/lib/crypto/source-credentials";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { workspaceSlug, label, host, port, username, password, basePath, enabled } = body;

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspaceSlug required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });
  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (label !== undefined) updateData.label = label;
  if (host !== undefined) updateData.host = host;
  if (port !== undefined) updateData.port = port;
  if (username !== undefined) updateData.username = username;
  if (password !== undefined) updateData.encryptedPassword = encryptPassword(password);
  if (basePath !== undefined) updateData.basePath = basePath;
  if (enabled !== undefined) updateData.enabled = enabled;

  const [updated] = await db
    .update(scanSources)
    .set(updateData)
    .where(
      and(eq(scanSources.id, id), eq(scanSources.workspaceId, workspace.id))
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json({ ...updated, encryptedPassword: "••••••••" });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
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

  const [deleted] = await db
    .delete(scanSources)
    .where(
      and(eq(scanSources.id, id), eq(scanSources.workspaceId, workspace.id))
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
