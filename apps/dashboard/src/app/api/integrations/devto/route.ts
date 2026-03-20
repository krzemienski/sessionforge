import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devtoIntegrations } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { verifyDevtoApiKey, DevtoApiError } from "@/lib/integrations/devto";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, devtoConnectSchema } from "@/lib/validation";
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

    if (!workspaceSlug)
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.INTEGRATIONS_READ
    );

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
  })(request);
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await request.json().catch(() => ({}));
    const { workspaceSlug, apiKey } = parseBody(devtoConnectSchema, rawBody);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.INTEGRATIONS_MANAGE
    );

    let user: Awaited<ReturnType<typeof verifyDevtoApiKey>>;
    try {
      user = await verifyDevtoApiKey(apiKey);
    } catch (err) {
      if (err instanceof DevtoApiError) {
        throw new AppError(
          err.message,
          ERROR_CODES.BAD_REQUEST,
          err.status === 401 ? 400 : err.status,
          { devtoCode: err.code }
        );
      }
      throw err;
    }

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
  })(request);
}

export async function DELETE(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug)
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.INTEGRATIONS_MANAGE
    );

    const existing = await db.query.devtoIntegrations.findFirst({
      where: eq(devtoIntegrations.workspaceId, workspace.id),
    });

    if (!existing)
      throw new AppError("Integration not found", ERROR_CODES.NOT_FOUND);

    await db
      .delete(devtoIntegrations)
      .where(eq(devtoIntegrations.workspaceId, workspace.id));

    return NextResponse.json({ disconnected: true });
  })(request);
}
