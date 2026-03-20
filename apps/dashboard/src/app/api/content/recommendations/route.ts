import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentRecommendations, recommendationFeedback } from "@sessionforge/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const minPriority = parseInt(searchParams.get("minPriority") ?? "0", 10);
    const status = searchParams.get("status") ?? "active";

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_READ
    );

  const conditions = [
    eq(contentRecommendations.workspaceId, workspace.id),
    eq(contentRecommendations.status, status),
  ];

  if (minPriority > 0) {
    conditions.push(gte(contentRecommendations.priority, minPriority));
  }

  const results = await db.query.contentRecommendations.findMany({
    where: and(...conditions),
    orderBy: [desc(contentRecommendations.priority), desc(contentRecommendations.createdAt)],
    limit,
    offset,
    with: {
      insight: true,
    },
  });

  return NextResponse.json({ recommendations: results, limit, offset });
  })(request);
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_EDIT
    );

  let body;
  try {
    body = await request.json();
  } catch {
    throw new AppError("Invalid JSON body", ERROR_CODES.BAD_REQUEST);
  }

  const { recommendationId, action } = body;

  if (!recommendationId || !action) {
    throw new AppError(
      "recommendationId and action are required",
      ERROR_CODES.BAD_REQUEST
    );
  }

  if (action !== "accepted" && action !== "dismissed") {
    throw new AppError(
      "action must be 'accepted' or 'dismissed'",
      ERROR_CODES.BAD_REQUEST
    );
  }

  const recommendation = await db.query.contentRecommendations.findFirst({
    where: eq(contentRecommendations.id, recommendationId),
  });

  if (!recommendation || recommendation.workspaceId !== workspace.id) {
    throw new AppError("Recommendation not found", ERROR_CODES.NOT_FOUND);
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: action === "accepted" ? "accepted" : "dismissed",
    updatedAt: now,
  };

  if (action === "accepted") {
    updateData.acceptedAt = now;
  } else {
    updateData.dismissedAt = now;
  }

  await db
    .update(contentRecommendations)
    .set(updateData)
    .where(eq(contentRecommendations.id, recommendationId));

  await db.insert(recommendationFeedback).values({
    recommendationId,
    userId: session.user.id,
    action: action as "accepted" | "dismissed",
  });

  return NextResponse.json({ success: true, action });
  })(request);
}
