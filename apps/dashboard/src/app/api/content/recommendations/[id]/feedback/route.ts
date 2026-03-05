import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentRecommendations, recommendationFeedback } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify recommendation exists and user owns the workspace
  const recommendation = await db.query.contentRecommendations.findFirst({
    where: eq(contentRecommendations.id, id),
    with: { workspace: true },
  });

  if (!recommendation) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  if (recommendation.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  // Normalize action values: "accept" -> "accepted", "dismiss" -> "dismissed"
  let normalizedAction: "accepted" | "dismissed";
  if (action === "accept" || action === "accepted") {
    normalizedAction = "accepted";
  } else if (action === "dismiss" || action === "dismissed") {
    normalizedAction = "dismissed";
  } else {
    return NextResponse.json(
      { error: "action must be 'accept', 'accepted', 'dismiss', or 'dismissed'" },
      { status: 400 }
    );
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: normalizedAction,
    updatedAt: now,
  };

  if (normalizedAction === "accepted") {
    updateData.acceptedAt = now;
  } else {
    updateData.dismissedAt = now;
  }

  try {
    // Update recommendation status
    await db
      .update(contentRecommendations)
      .set(updateData)
      .where(eq(contentRecommendations.id, id));

    // Record feedback for ML improvement
    await db.insert(recommendationFeedback).values({
      recommendationId: id,
      userId: session.user.id,
      action: normalizedAction,
    });

    return NextResponse.json({ success: true, action: normalizedAction });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feedback recording failed" },
      { status: 500 }
    );
  }
}
