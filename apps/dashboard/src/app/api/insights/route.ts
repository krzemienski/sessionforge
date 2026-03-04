import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { insights, workspaces, insightCategoryEnum } from "@sessionforge/db";
import { eq, desc, and, gte, lte } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

type InsightCategory = (typeof insightCategoryEnum.enumValues)[number];

export async function GET(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspace");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const minScore = parseFloat(searchParams.get("minScore") ?? "0");
    const category = searchParams.get("category");
    const sessionId = searchParams.get("sessionId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const conditions = [eq(insights.workspaceId, workspace.id)];
    if (minScore > 0) {
      conditions.push(gte(insights.compositeScore, minScore));
    }
    if (category && insightCategoryEnum.enumValues.includes(category as InsightCategory)) {
      conditions.push(eq(insights.category, category as InsightCategory));
    }
    if (sessionId) {
      conditions.push(eq(insights.sessionId, sessionId));
    }
    if (dateFrom) {
      conditions.push(gte(insights.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(insights.createdAt, new Date(dateTo)));
    }

    const results = await db.query.insights.findMany({
      where: and(...conditions),
      orderBy: [desc(insights.compositeScore)],
      limit,
      offset,
    });

    return NextResponse.json({ insights: results, limit, offset });
  })(req);
}
