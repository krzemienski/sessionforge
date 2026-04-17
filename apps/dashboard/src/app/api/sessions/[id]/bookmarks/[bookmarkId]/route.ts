import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
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

/**
 * DELETE /api/sessions/[id]/bookmarks/[bookmarkId]
 * Deletes a specific bookmark by its ID.
 */
export const DELETE = withApiHandler(async (_request, ctx) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, bookmarkId } = (await ctx!.params) as { id: string; bookmarkId: string };

  const resolved = await resolveSession(session, id);

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
