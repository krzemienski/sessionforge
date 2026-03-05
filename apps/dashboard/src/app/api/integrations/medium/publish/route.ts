import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, mediumIntegrations, mediumPublications } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import {
  publishToMedium,
  publishToMediumPublication,
  MediumApiError,
} from "@/lib/integrations/medium";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");

  if (!postId) {
    return NextResponse.json({ error: "postId query param required" }, { status: 400 });
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const publication = await db.query.mediumPublications.findFirst({
    where: eq(mediumPublications.postId, postId),
  });

  if (!publication) {
    return NextResponse.json({ published: false });
  }

  return NextResponse.json({
    published: true,
    mediumArticleId: publication.mediumArticleId,
    mediumUrl: publication.mediumUrl,
    publishedAsDraft: publication.publishedAsDraft,
    syncedAt: publication.syncedAt,
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { postId, workspaceSlug, publishStatus, tags, canonicalUrl, publicationId, notifyFollowers } = body;

  if (!postId || !workspaceSlug) {
    return NextResponse.json(
      { error: "postId and workspaceSlug are required" },
      { status: 400 }
    );
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (
    post.workspace.slug !== workspaceSlug ||
    post.workspace.ownerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const integration = await db.query.mediumIntegrations.findFirst({
    where: and(
      eq(mediumIntegrations.workspaceId, post.workspaceId),
      eq(mediumIntegrations.enabled, true)
    ),
  });

  if (!integration) {
    return NextResponse.json(
      { error: "Medium integration not configured or disabled" },
      { status: 400 }
    );
  }

  const existing = await db.query.mediumPublications.findFirst({
    where: eq(mediumPublications.postId, postId),
  });

  if (existing) {
    return NextResponse.json(
      { error: "Post already published to Medium. Use PUT to update." },
      { status: 409 }
    );
  }

  try {
    const articleInput = {
      title: post.title,
      contentFormat: "markdown" as const,
      content: post.markdown,
      publishStatus: (publishStatus ?? "draft") as "draft" | "public" | "unlisted",
      tags: tags ?? [],
      canonicalUrl,
      notifyFollowers: notifyFollowers ?? false,
    };

    let result;
    if (publicationId) {
      result = await publishToMediumPublication(
        integration.apiKey,
        publicationId,
        articleInput
      );
    } else {
      // Use username as userId for user posts
      const userId = integration.username ?? "";
      result = await publishToMedium(integration.apiKey, userId, articleInput);
    }

    await db.insert(mediumPublications).values({
      workspaceId: post.workspaceId,
      postId,
      integrationId: integration.id,
      mediumArticleId: result.id,
      mediumUrl: result.url,
      publishedAsDraft: result.publishStatus !== "public",
      syncedAt: new Date(),
    });

    if (result.publishStatus === "public") {
      await db
        .update(posts)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(posts.id, postId));
    }

    return NextResponse.json(
      {
        mediumArticleId: result.id,
        mediumUrl: result.url,
        publishStatus: result.publishStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof MediumApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish to Medium" },
      { status: 500 }
    );
  }
}
