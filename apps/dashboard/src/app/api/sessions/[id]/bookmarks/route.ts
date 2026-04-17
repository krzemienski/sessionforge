import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, sessionBookmarks } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { withApiHandler } from "@/lib/api-handler";
import type { Session } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function resolveSession(
  session: Session,
  sessionId: string
): Promise<{ workspaceId: string }> {
  const rows = await db
    .select({ id: claudeSessions.id, workspaceId: claudeSessions.workspaceId })
    .from(claudeSessions)
    .where(eq(claudeSessions.id, sessionId))
    .limit(1);

  if (!rows.length) {
    throw new AppError("Session not found", ERROR_CODES.NOT_FOUND);
  }

  await getAuthorizedWorkspaceById(
    session,
    rows[0].workspaceId,
    PERMISSIONS.SESSIONS_READ
  );

  return { workspaceId: rows[0].workspaceId };
}

export const GET = withApiHandler(async (_request, ctx) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await ctx!.params) as { id: string };

  await resolveSession(session, id);

  const bookmarks = await db
    .select()
    .from(sessionBookmarks)
    .where(eq(sessionBookmarks.sessionId, id))
    .orderBy(sessionBookmarks.messageIndex);

  return NextResponse.json(bookmarks);
});

export const POST = withApiHandler(async (request, ctx) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await ctx!.params) as { id: string };

  const resolved = await resolveSession(session, id);

  let body: { messageIndex?: unknown; label?: unknown; note?: unknown };
  try {
    body = await (request as NextRequest).json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messageIndex, label, note } = body;

  if (typeof messageIndex !== "number" || !Number.isInteger(messageIndex) || messageIndex < 0) {
    return NextResponse.json({ error: "messageIndex must be a non-negative integer" }, { status: 400 });
  }

  if (typeof label !== "string" || label.trim().length === 0) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const [bookmark] = await db
    .insert(sessionBookmarks)
    .values({
      workspaceId: resolved.workspaceId,
      sessionId: id,
      messageIndex,
      label: label.trim(),
      note: typeof note === "string" ? note.trim() || null : null,
    })
    .returning();

  return NextResponse.json(bookmark, { status: 201 });
});

export const DELETE = withApiHandler(async (request, ctx) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await ctx!.params) as { id: string };

  const resolved = await resolveSession(session, id);

  const { searchParams } = new URL(request.url);
  const bookmarkId = searchParams.get("bookmarkId");

  if (!bookmarkId) {
    return NextResponse.json({ error: "bookmarkId query param required" }, { status: 400 });
  }

  const deleted = await db
    .delete(sessionBookmarks)
    .where(
      and(
        eq(sessionBookmarks.id, bookmarkId),
        eq(sessionBookmarks.sessionId, id),
        eq(sessionBookmarks.workspaceId, resolved.workspaceId)
      )
    )
    .returning({ id: sessionBookmarks.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Bookmark not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: deleted[0].id });
});
