import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const workspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id))
      .limit(1);

    if (!workspace.length) {
      throw new AppError("No workspace found", ERROR_CODES.NOT_FOUND);
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
      throw new AppError("Session not found", ERROR_CODES.NOT_FOUND);
    }

    return NextResponse.json(rows[0]);
  })(req);
}
