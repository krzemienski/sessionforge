import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceActivity } from "@sessionforge/db";
import { eq, and, desc } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.ANALYTICS_READ
    );

    const { searchParams } = new URL(req.url);
    const actionFilter = searchParams.get("action");
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50", 10) || 50,
      100
    );

    const conditions = [eq(workspaceActivity.workspaceId, workspace.id)];
    if (actionFilter) {
      conditions.push(eq(workspaceActivity.action, actionFilter));
    }

    const activity = await db
      .select()
      .from(workspaceActivity)
      .where(and(...conditions))
      .orderBy(desc(workspaceActivity.createdAt))
      .limit(limit);

    return NextResponse.json(activity);
  })(req);
}
