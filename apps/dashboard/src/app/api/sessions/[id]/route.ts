import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    // Look up the session first, then verify workspace access
    const rows = await db
      .select()
      .from(claudeSessions)
      .where(eq(claudeSessions.id, id))
      .limit(1);

    if (!rows.length) {
      throw new AppError("Session not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(
      session,
      rows[0].workspaceId,
      PERMISSIONS.SESSIONS_READ
    );

    return NextResponse.json(rows[0]);
  })(req);
}
