import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, devtoIntegrations, devtoPublications } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import {
  publishToDevto,
  updateDevtoArticle,
  DevtoApiError,
} from "@/lib/integrations/devto";

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

  const publication = await db.query.devtoPublications.findFirst({
    where: eq(devtoPublications.postId, postId),
  });

  if (!publication) {
    return NextResponse.json({ published: false });
  }

  return NextResponse.json({
    published: true,
    devtoArticleId: publication.devtoArticleId,
    devtoUrl: publication.devtoUrl,
    publishedAsDraft: publication.publishedAsDraft,
    syncedAt: publication.syncedAt,
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { postId, workspaceSlug, published, tags, canonicalUrl, series } = body;

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

  const integration = await db.query.devtoIntegrations.findFirst({
    where: and(
      eq(devtoIntegrations.workspaceId, post.workspaceId),
      eq(devtoIntegrations.enabled, true)
    ),
  });

  if (!integration) {
    return NextResponse.json(
      { error: "Dev.to integration not configured or disabled" },
      { status: 400 }
    );
  }

  const existing = await db.query.devtoPublications.findFirst({
    where: eq(devtoPublications.postId, postId),
  });

  if (existing) {
    return NextResponse.json(
      { error: "Post already published to Dev.to. Use PUT to update." },
      { status: 409 }
    );
  }

  try {
    const result = await publishToDevto(integration.apiKey, {
      title: post.title,
      body_markdown: post.markdown,
      published: published ?? false,
      tags: tags ?? [],
      canonical_url: canonicalUrl,
      series,
    });

    await db.insert(devtoPublications).values({
      workspaceId: post.workspaceId,
      postId,
      integrationId: integration.id,
      devtoArticleId: result.id,
      devtoUrl: result.url,
      publishedAsDraft: !result.published,
      syncedAt: new Date(),
    });

    if (result.published) {
      await db
        .update(posts)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(posts.id, postId));
    }

    return NextResponse.json(
      {
        devtoArticleId: result.id,
        devtoUrl: result.url,
        published: result.published,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DevtoApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish to Dev.to" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { postId, workspaceSlug, published, tags, canonicalUrl, series } = body;

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

  const publication = await db.query.devtoPublications.findFirst({
    where: eq(devtoPublications.postId, postId),
    with: { integration: true },
  });

  if (!publication) {
    return NextResponse.json(
      { error: "Post not published to Dev.to yet. Use POST to publish first." },
      { status: 404 }
    );
  }

  if (!publication.integration.enabled) {
    return NextResponse.json(
      { error: "Dev.to integration is disabled" },
      { status: 400 }
    );
  }

  try {
    const result = await updateDevtoArticle(
      publication.integration.apiKey,
      publication.devtoArticleId,
      {
        title: post.title,
        body_markdown: post.markdown,
        published: published ?? !publication.publishedAsDraft,
        tags: tags ?? [],
        canonical_url: canonicalUrl,
        series,
      }
    );

    await db
      .update(devtoPublications)
      .set({
        devtoUrl: result.url,
        publishedAsDraft: !result.published,
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(devtoPublications.postId, postId));

    if (result.published) {
      await db
        .update(posts)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(posts.id, postId));
    }

    return NextResponse.json({
      devtoArticleId: result.id,
      devtoUrl: result.url,
      published: result.published,
    });
  } catch (error) {
    if (error instanceof DevtoApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update Dev.to article" },
      { status: 500 }
    );
  }
}
