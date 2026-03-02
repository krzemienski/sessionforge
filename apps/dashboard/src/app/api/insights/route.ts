import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { insights, workspaces, insightCategoryEnum } from "@sessionforge/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

type InsightCategory = (typeof insightCategoryEnum.enumValues)[number];

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const minScore = parseFloat(searchParams.get("minScore") ?? "0");
  const category = searchParams.get("category");
  const sessionId = searchParams.get("sessionId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
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
}
