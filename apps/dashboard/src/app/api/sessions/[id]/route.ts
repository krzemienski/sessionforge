import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id))
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(claudeSessions)
    .where(
      and(
        eq(claudeSessions.workspaceId, workspace[0].id),
        eq(claudeSessions.id, id)
      )
    )
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}
