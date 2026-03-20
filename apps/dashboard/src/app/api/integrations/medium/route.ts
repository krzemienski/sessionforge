import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mediumIntegrations } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { verifyMediumToken, MediumApiError } from "@/lib/integrations/medium";
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

  const integration = await db.query.mediumIntegrations.findFirst({
    where: eq(mediumIntegrations.workspaceId, workspace.id),
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

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_MANAGE
  );

  try {
    const user = await verifyMediumToken(apiKey);

    await db
      .insert(mediumIntegrations)
      .values({
        workspaceId: workspace.id,
        apiKey,
        mediumUserId: user.id,
        username: user.username,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: mediumIntegrations.workspaceId,
        set: {
          apiKey,
          mediumUserId: user.id,
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
    if (error instanceof MediumApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect Medium account" },
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

  const existing = await db.query.mediumIntegrations.findFirst({
    where: eq(mediumIntegrations.workspaceId, workspace.id),
  });

  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  await db
    .delete(mediumIntegrations)
    .where(eq(mediumIntegrations.workspaceId, workspace.id));

  return NextResponse.json({ disconnected: true });
}
