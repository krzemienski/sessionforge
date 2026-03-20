import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { insights } from "@sessionforge/db";
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

    const insight = await db.query.insights.findFirst({
      where: eq(insights.id, id),
      with: { workspace: true, session: true },
    });

    if (!insight) {
      throw new AppError("Insight not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(
      session,
      insight.workspaceId,
      PERMISSIONS.INSIGHTS_READ
    );

    return NextResponse.json(insight);
  })(req);
}
