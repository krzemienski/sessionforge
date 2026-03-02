import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, wordpressConnections } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { encryptAppPassword } from "@/lib/wordpress/crypto";

export const dynamic = "force-dynamic";

async function getWorkspaceId(
  session: Awaited<ReturnType<typeof auth.api.getSession>>,
  slug: string
): Promise<string | null> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, session!.user.id),
        eq(workspaces.slug, slug)
      )
    )
    .limit(1);

  return rows.length ? rows[0].id : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const wsId = await getWorkspaceId(session, slug);
  if (!wsId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      siteUrl: wordpressConnections.siteUrl,
      username: wordpressConnections.username,
      isActive: wordpressConnections.isActive,
    })
    .from(wordpressConnections)
    .where(
      and(
        eq(wordpressConnections.workspaceId, wsId),
        eq(wordpressConnections.isActive, true)
      )
    )
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({ connected: false });
  }

  const { siteUrl, username } = rows[0];
  return NextResponse.json({ connected: true, siteUrl, username });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const wsId = await getWorkspaceId(session, slug);
  if (!wsId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

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
    return NextResponse.json(
      { error: "siteUrl, username, and appPassword are required" },
      { status: 400 }
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
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const wsId = await getWorkspaceId(session, slug);
  if (!wsId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  await db
    .update(wordpressConnections)
    .set({ isActive: false })
    .where(eq(wordpressConnections.workspaceId, wsId));

  return NextResponse.json({ connected: false });
}
