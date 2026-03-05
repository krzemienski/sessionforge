import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentRecommendations, workspaces, recommendationFeedback } from "@sessionforge/db";
import { eq, desc, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const minPriority = parseInt(searchParams.get("minPriority") ?? "0", 10);
  const status = searchParams.get("status") ?? "active";

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

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
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { recommendationId, action } = body;

  if (!recommendationId || !action) {
    return NextResponse.json(
      { error: "recommendationId and action are required" },
      { status: 400 }
    );
  }

  if (action !== "accepted" && action !== "dismissed") {
    return NextResponse.json(
      { error: "action must be 'accepted' or 'dismissed'" },
      { status: 400 }
    );
  }

  const recommendation = await db.query.contentRecommendations.findFirst({
    where: eq(contentRecommendations.id, recommendationId),
  });

  if (!recommendation || recommendation.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
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
}
