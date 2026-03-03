import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
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

/**
 * DELETE /api/sessions/[id]/bookmarks/[bookmarkId]
 * Deletes a specific bookmark by its ID.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bookmarkId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, bookmarkId } = await params;

  const resolved = await resolveSession(session.user.id, id);
  if (!resolved) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
