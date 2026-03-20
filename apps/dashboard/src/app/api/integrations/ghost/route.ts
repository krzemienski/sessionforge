import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ghostIntegrations } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { verifyGhostApiKey, GhostApiError } from "@/lib/integrations/ghost";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_READ
  );

  const integration = await db.query.ghostIntegrations.findFirst({
    where: eq(ghostIntegrations.workspaceId, workspace.id),
    columns: {
      id: true,
      ghostUrl: true,
      enabled: true,
      createdAt: true,
    },
  });

  if (!integration) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    ghostUrl: integration.ghostUrl,
    enabled: integration.enabled,
    connectedAt: integration.createdAt,
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, adminApiKey, ghostUrl } = body;

  if (!workspaceSlug || !adminApiKey || !ghostUrl) {
    return NextResponse.json(
      { error: "workspaceSlug, adminApiKey, and ghostUrl are required" },
      { status: 400 }
    );
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_MANAGE
  );

  try {
    await verifyGhostApiKey(adminApiKey, ghostUrl);

    await db
      .insert(ghostIntegrations)
      .values({
        workspaceId: workspace.id,
        adminApiKey,
        ghostUrl,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: ghostIntegrations.workspaceId,
        set: {
          adminApiKey,
          ghostUrl,
          enabled: true,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json(
      { connected: true, ghostUrl },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof GhostApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect Ghost instance" },
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

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_MANAGE
  );

  const existing = await db.query.ghostIntegrations.findFirst({
    where: eq(ghostIntegrations.workspaceId, workspace.id),
  });

  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  await db
    .delete(ghostIntegrations)
    .where(eq(ghostIntegrations.workspaceId, workspace.id));

  return NextResponse.json({ disconnected: true });
}
