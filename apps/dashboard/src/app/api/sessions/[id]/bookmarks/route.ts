import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, sessionBookmarks } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { AppError, ERROR_CODES, formatErrorResponse } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import type { Session } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

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

function handleError(error: unknown, route: string): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
  }
  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      route,
      error: error instanceof Error ? error.message : String(error),
      code: ERROR_CODES.INTERNAL_ERROR,
    })
  );
  return NextResponse.json(
    { error: "Internal server error", code: ERROR_CODES.INTERNAL_ERROR },
    { status: 500 }
  );
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    await resolveSession(session, id);

    const bookmarks = await db
      .select()
      .from(sessionBookmarks)
      .where(eq(sessionBookmarks.sessionId, id))
      .orderBy(sessionBookmarks.messageIndex);

    return NextResponse.json(bookmarks);
  } catch (error) {
    return handleError(error, "GET /api/sessions/[id]/bookmarks");
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    const resolved = await resolveSession(session, id);

    let body: { messageIndex?: unknown; label?: unknown; note?: unknown };
    try {
      body = await req.json();
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
  } catch (error) {
    return handleError(error, "POST /api/sessions/[id]/bookmarks");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    const resolved = await resolveSession(session, id);

    const { searchParams } = new URL(req.url);
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
  } catch (error) {
    return handleError(error, "DELETE /api/sessions/[id]/bookmarks");
  }
}
