import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentRecommendations, recommendationFeedback } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { createPost } from "@/lib/ai/tools/post-manager";
import type { contentTypeEnum } from "@sessionforge/db";

type ContentType = (typeof contentTypeEnum.enumValues)[number];

const VALID_CONTENT_TYPES = new Set<string>([
  "blog_post",
  "twitter_thread",
  "linkedin_post",
  "changelog",
  "newsletter",
  "devto_post",
  "custom",
]);

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

    // When accepting, create a draft post from the recommendation so the user
    // has a starting point to write from (satisfies the "creates a draft post"
    // acceptance criterion).
    let draftPostId: string | undefined;
    if (normalizedAction === "accepted") {
      const rawContentType = recommendation.suggestedContentType;
      const contentType: ContentType =
        rawContentType && VALID_CONTENT_TYPES.has(rawContentType)
          ? (rawContentType as ContentType)
          : "blog_post";

      const placeholderMarkdown = [
        `# ${recommendation.title}`,
        "",
        `> **AI Recommendation:** ${recommendation.reasoning}`,
        "",
        "<!-- Start writing your post here. Replace this placeholder with your content. -->",
      ].join("\n");

      const draftPost = await createPost({
        workspaceId: recommendation.workspaceId,
        title: recommendation.title,
        markdown: placeholderMarkdown,
        contentType,
        insightId: recommendation.insightId ?? undefined,
        status: "draft",
        sourceMetadata: {
          sessionIds: [],
          insightIds: recommendation.insightId ? [recommendation.insightId] : [],
          generatedBy: "manual",
        },
      });

      draftPostId = draftPost?.id;
    }

    return NextResponse.json({
      success: true,
      action: normalizedAction,
      ...(draftPostId ? { draftPostId } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feedback recording failed" },
      { status: 500 }
    );
  }
}
