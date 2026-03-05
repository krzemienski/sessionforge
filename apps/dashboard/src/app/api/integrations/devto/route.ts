import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devtoIntegrations, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { verifyDevtoApiKey, DevtoApiError } from "@/lib/integrations/devto";

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

  const integration = await db.query.devtoIntegrations.findFirst({
    where: eq(devtoIntegrations.workspaceId, workspace.id),
    columns: {
      id: true,
      username: true,
      enabled: true,
      createdAt: true,
    },
  });

  if (!integration) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    username: integration.username,
    enabled: integration.enabled,
    connectedAt: integration.createdAt,
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, apiKey } = body;

  if (!workspaceSlug || !apiKey) {
    return NextResponse.json(
      { error: "workspaceSlug and apiKey are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const user = await verifyDevtoApiKey(apiKey);

    await db
      .insert(devtoIntegrations)
      .values({
        workspaceId: workspace.id,
        apiKey,
        username: user.username,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: devtoIntegrations.workspaceId,
        set: {
          apiKey,
          username: user.username,
          enabled: true,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json(
      { connected: true, username: user.username },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DevtoApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect Dev.to account" },
      { status: 500 }
    );
  }
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

  const existing = await db.query.devtoIntegrations.findFirst({
    where: eq(devtoIntegrations.workspaceId, workspace.id),
  });

  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  await db
    .delete(devtoIntegrations)
    .where(eq(devtoIntegrations.workspaceId, workspace.id));

  return NextResponse.json({ disconnected: true });
}
