import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions } from "@sessionforge/db";
import { eq, desc, asc, gte, and, sql } from "drizzle-orm/sql";
import { requireApiKey, apiResponse, withV1ApiHandler } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export const GET = withV1ApiHandler(async (req) => {
  const auth = await requireApiKey(req as NextRequest);

  const { searchParams } = (req as NextRequest).nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const sort = searchParams.get("sort") ?? "startedAt";
  const order = searchParams.get("order") ?? "desc";
  const project = searchParams.get("project");
  const minMessages = searchParams.get("minMessages")
    ? parseInt(searchParams.get("minMessages")!)
    : null;

  const wsId = auth.workspace.id;

  const conditions = [eq(claudeSessions.workspaceId, wsId)];
  if (project) {
    conditions.push(eq(claudeSessions.projectName, project));
  }
  if (minMessages !== null) {
    conditions.push(gte(claudeSessions.messageCount, minMessages));
  }

  const where = and(...conditions);

  const validSortColumns: Record<string, typeof claudeSessions.startedAt> = {
    startedAt: claudeSessions.startedAt,
    messageCount: claudeSessions.messageCount as unknown as typeof claudeSessions.startedAt,
    costUsd: claudeSessions.costUsd as unknown as typeof claudeSessions.startedAt,
    durationSeconds: claudeSessions.durationSeconds as unknown as typeof claudeSessions.startedAt,
  };

  const sortCol = validSortColumns[sort] ?? claudeSessions.startedAt;
  const orderFn = order === "asc" ? asc : desc;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(claudeSessions)
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(claudeSessions)
      .where(where),
  ]);

  return apiResponse(rows, {
    total: Number(countResult[0]?.count ?? 0),
    limit,
    offset,
  });
});
