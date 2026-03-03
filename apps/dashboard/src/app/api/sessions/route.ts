import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, workspaces } from "@sessionforge/db";
import { eq, desc, asc, gte, lte, and, sql, isNotNull, isNull } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const sort = searchParams.get("sort") ?? "startedAt";
    const order = searchParams.get("order") ?? "desc";
    const project = searchParams.get("project");
    const minMessages = searchParams.get("minMessages")
      ? parseInt(searchParams.get("minMessages")!)
      : null;
    const maxMessages = searchParams.get("maxMessages")
      ? parseInt(searchParams.get("maxMessages")!)
      : null;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const hasSummaryParam = searchParams.get("hasSummary");

    const workspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id))
      .limit(1);

    if (!workspace.length) {
      throw new AppError("No workspace found", ERROR_CODES.NOT_FOUND);
    }

    const wsId = workspace[0].id;

    const conditions = [eq(claudeSessions.workspaceId, wsId)];
    if (project) {
      conditions.push(eq(claudeSessions.projectName, project));
    }
    if (minMessages !== null) {
      conditions.push(gte(claudeSessions.messageCount, minMessages));
    }
    if (maxMessages !== null) {
      conditions.push(lte(claudeSessions.messageCount, maxMessages));
    }
    if (dateFrom) {
      conditions.push(gte(claudeSessions.startedAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(claudeSessions.startedAt, new Date(dateTo)));
    }
    if (hasSummaryParam === "true") {
      conditions.push(isNotNull(claudeSessions.summary));
    } else if (hasSummaryParam === "false") {
      conditions.push(isNull(claudeSessions.summary));
    }

    const where = and(...conditions);

    const validSortColumns: Record<string, typeof claudeSessions.startedAt> = {
      startedAt: claudeSessions.startedAt,
      messageCount: claudeSessions.messageCount as unknown as typeof claudeSessions.startedAt,
      costUsd: claudeSessions.costUsd as unknown as typeof claudeSessions.startedAt,
      durationSeconds: claudeSessions.durationSeconds as unknown as typeof claudeSessions.startedAt,
      endedAt: claudeSessions.endedAt as unknown as typeof claudeSessions.startedAt,
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

    return NextResponse.json({
      data: rows,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    });
  })(req);
}
