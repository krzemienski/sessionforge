import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wordpressConnections } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { encryptAppPassword } from "@/lib/wordpress/crypto";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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
      PERMISSIONS.INTEGRATIONS_MANAGE
    );

    const rows = await db
      .select({
        siteUrl: wordpressConnections.siteUrl,
        username: wordpressConnections.username,
        isActive: wordpressConnections.isActive,
      })
      .from(wordpressConnections)
      .where(
        and(
          eq(wordpressConnections.workspaceId, workspace.id),
          eq(wordpressConnections.isActive, true)
        )
      )
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({ connected: false });
    }

    const { siteUrl, username } = rows[0];
    return NextResponse.json({ connected: true, siteUrl, username });
  })(req);
}

export async function POST(
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
    const { siteUrl, username, appPassword } = body as Record<string, unknown>;

    if (
      typeof siteUrl !== "string" ||
      typeof username !== "string" ||
      typeof appPassword !== "string" ||
      !siteUrl.trim() ||
      !username.trim() ||
      !appPassword.trim()
    ) {
      throw new AppError(
        "siteUrl, username, and appPassword are required",
        ERROR_CODES.BAD_REQUEST
      );
    }

    const encryptedAppPassword = encryptAppPassword(appPassword);

    const existing = await db
      .select({ id: wordpressConnections.id })
      .from(wordpressConnections)
      .where(eq(wordpressConnections.workspaceId, wsId))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(wordpressConnections)
        .set({
          siteUrl: siteUrl.trim(),
          username: username.trim(),
          encryptedAppPassword,
          isActive: true,
        })
        .where(eq(wordpressConnections.workspaceId, wsId))
        .returning({
          siteUrl: wordpressConnections.siteUrl,
          username: wordpressConnections.username,
          isActive: wordpressConnections.isActive,
        });
    } else {
      [result] = await db
        .insert(wordpressConnections)
        .values({
          workspaceId: wsId,
          siteUrl: siteUrl.trim(),
          username: username.trim(),
          encryptedAppPassword,
          isActive: true,
        })
        .returning({
          siteUrl: wordpressConnections.siteUrl,
          username: wordpressConnections.username,
          isActive: wordpressConnections.isActive,
        });
    }

    return NextResponse.json({ connected: true, ...result });
  })(req);
}

export async function DELETE(
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

    await db
      .update(wordpressConnections)
      .set({ isActive: false })
      .where(eq(wordpressConnections.workspaceId, workspace.id));

    return NextResponse.json({ connected: false });
  })(req);
}
