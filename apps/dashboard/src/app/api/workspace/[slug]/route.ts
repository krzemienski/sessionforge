import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rows = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.ownerId, session.user.id),
          eq(workspaces.slug, slug)
        )
      )
      .limit(1);

    if (!rows.length) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    return NextResponse.json(rows[0]);
  })(req);
}
