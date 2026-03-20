import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrationSettings } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return "********";
  return token.slice(0, 8) + "...";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.INTEGRATIONS_READ
    );

    const wsId = workspace.id;

    const rows = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.workspaceId, wsId))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({
        hashnodeApiToken: null,
        hashnodePublicationId: null,
        hashnodeDefaultCanonicalDomain: null,
      });
    }

    const settings = rows[0];

    return NextResponse.json({
      hashnodeApiToken: maskToken(settings.hashnodeApiToken),
      hashnodePublicationId: settings.hashnodePublicationId,
      hashnodeDefaultCanonicalDomain: settings.hashnodeDefaultCanonicalDomain,
    });
  })(req);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.INTEGRATIONS_MANAGE
    );

    const wsId = workspace.id;
    const body = await req.json().catch(() => ({}));

    const { hashnodeToken, hashnodePublicationId, hashnodeDefaultCanonicalDomain } =
      body as Record<string, unknown>;

    const updateValues: Record<string, unknown> = {};
    if (hashnodeToken !== undefined) updateValues.hashnodeApiToken = hashnodeToken;
    if (hashnodePublicationId !== undefined) updateValues.hashnodePublicationId = hashnodePublicationId;
    if (hashnodeDefaultCanonicalDomain !== undefined)
      updateValues.hashnodeDefaultCanonicalDomain = hashnodeDefaultCanonicalDomain;

    const existing = await db
      .select({ id: integrationSettings.id })
      .from(integrationSettings)
      .where(eq(integrationSettings.workspaceId, wsId))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(integrationSettings)
        .set(updateValues)
        .where(eq(integrationSettings.workspaceId, wsId))
        .returning();
    } else {
      [result] = await db
        .insert(integrationSettings)
        .values({ workspaceId: wsId, ...updateValues })
        .returning();
    }

    return NextResponse.json({
      hashnodeApiToken: maskToken(result.hashnodeApiToken),
      hashnodePublicationId: result.hashnodePublicationId,
      hashnodeDefaultCanonicalDomain: result.hashnodeDefaultCanonicalDomain,
    });
  })(req);
}
