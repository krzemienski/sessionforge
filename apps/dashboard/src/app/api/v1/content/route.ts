import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq, desc, and, sql } from "drizzle-orm/sql";
import { authenticateApiKey, apiResponse, withV1ApiHandler } from "@/lib/api-auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withV1ApiHandler(async (req) => {
  const auth = await authenticateApiKey(req as NextRequest);
  if (!auth) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

  const { searchParams } = (req as NextRequest).nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const contentType = searchParams.get("type");
  const status = searchParams.get("status");

  const wsId = auth.workspace.id;

  const conditions = [eq(posts.workspaceId, wsId)];
  if (contentType) {
    conditions.push(
      eq(posts.contentType, contentType as typeof posts.contentType.enumValues[number])
    );
  }
  if (status) {
    conditions.push(
      eq(posts.status, status as typeof posts.status.enumValues[number])
    );
  }

  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(where),
  ]);

  return apiResponse(rows, {
    total: Number(countResult[0]?.count ?? 0),
    limit,
    offset,
  });
});
