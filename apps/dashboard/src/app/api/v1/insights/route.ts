import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { insights } from "@sessionforge/db";
import { eq, desc, and, gte, sql } from "drizzle-orm/sql";
import { requireApiKey, apiResponse, withV1ApiHandler } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export const GET = withV1ApiHandler(async (req) => {
  const auth = await requireApiKey(req as NextRequest);

  const { searchParams } = (req as NextRequest).nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const minScore = parseFloat(searchParams.get("minScore") ?? "0");
  const category = searchParams.get("category");

  const wsId = auth.workspace.id;

  const conditions = [eq(insights.workspaceId, wsId)];
  if (minScore > 0) {
    conditions.push(gte(insights.compositeScore, minScore));
  }
  if (category) {
    conditions.push(eq(insights.category, category as typeof insights.category._.data));
  }

  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(insights)
      .where(where)
      .orderBy(desc(insights.compositeScore))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(insights)
      .where(where),
  ]);

  return apiResponse(rows, {
    total: Number(countResult[0]?.count ?? 0),
    limit,
    offset,
  });
});
