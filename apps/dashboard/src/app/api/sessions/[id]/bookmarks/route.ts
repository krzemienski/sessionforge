import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, sessionBookmarks, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function resolveSession(
  userId: string,
  sessionId: string
): Promise<{ workspaceId: string } | null> {
  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);

  if (!workspace.length) return null;

  const rows = await db
    .select({ id: claudeSessions.id, workspaceId: claudeSessions.workspaceId })
    .from(claudeSessions)
    .where(
      and(
        eq(claudeSessions.workspaceId, workspace[0].id),
        eq(claudeSessions.id, sessionId)
      )
    )
    .limit(1);

  if (!rows.length) return null;

  return { workspaceId: rows[0].workspaceId };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const resolved = await resolveSession(session.user.id, id);
  if (!resolved) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const bookmarks = await db
    .select()
    .from(sessionBookmarks)
    .where(eq(sessionBookmarks.sessionId, id))
    .orderBy(sessionBookmarks.messageIndex);

  return NextResponse.json({ bookmarks });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const resolved = await resolveSession(session.user.id, id);
  if (!resolved) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let body: { messageIndex?: unknown; label?: unknown; note?: unknown };
  try {
    body = await request.json();
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
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const resolved = await resolveSession(session.user.id, id);
  if (!resolved) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

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
}
