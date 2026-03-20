import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, ghostIntegrations, ghostPublications } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import {
  publishToGhost,
  updateGhostPost,
  GhostApiError,
} from "@/lib/integrations/ghost";
import { canPublish, getOverridePolicy } from "@/lib/verification/publish-gate";

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

  const publication = await db.query.ghostPublications.findFirst({
    where: eq(ghostPublications.postId, postId),
  });

  if (!publication) {
    return NextResponse.json({ published: false });
  }

  return NextResponse.json({
    published: true,
    ghostPostId: publication.ghostPostId,
    ghostUrl: publication.ghostUrl,
    publishedAsDraft: publication.publishedAsDraft,
    syncedAt: publication.syncedAt,
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    postId,
    workspaceSlug,
    status,
    tags,
    canonicalUrl,
    visibility,
    featureImage,
    customExcerpt,
    authors,
  } = body;

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

  // Publish-gate check: block if unresolved critical risk flags exist
  const flags = post.riskFlags ?? [];
  const gateResult = canPublish(flags);

  if (!gateResult.allowed) {
    if (!body.overrideRiskFlags) {
      return NextResponse.json(
        {
          error: "unresolved_critical_flags",
          flags: gateResult.blockingFlags,
          requiresOverride: true,
        },
        { status: 409 }
      );
    }

    const overridePolicy = getOverridePolicy("owner");
    if (!overridePolicy.canOverride) {
      return NextResponse.json(
        { error: "Insufficient permissions to override risk flags" },
        { status: 403 }
      );
    }
  }

  const integration = await db.query.ghostIntegrations.findFirst({
    where: and(
      eq(ghostIntegrations.workspaceId, post.workspaceId),
      eq(ghostIntegrations.enabled, true)
    ),
  });

  if (!integration) {
    return NextResponse.json(
      { error: "Ghost integration not configured or disabled" },
      { status: 400 }
    );
  }

  const existing = await db.query.ghostPublications.findFirst({
    where: eq(ghostPublications.postId, postId),
  });

  if (existing) {
    return NextResponse.json(
      { error: "Post already published to Ghost. Use PUT to update." },
      { status: 409 }
    );
  }

  try {
    const result = await publishToGhost(
      integration.adminApiKey,
      integration.ghostUrl,
      {
        title: post.title,
        html: post.content,
        status: status ?? "draft",
        tags: tags ? tags.map((t: string) => ({ name: t })) : [],
        authors: authors ? authors.map((a: string) => ({ email: a })) : undefined,
        canonical_url: canonicalUrl,
        visibility: visibility ?? "public",
        feature_image: featureImage,
        custom_excerpt: customExcerpt,
      }
    );

    await db.insert(ghostPublications).values({
      workspaceId: post.workspaceId,
      postId,
      integrationId: integration.id,
      ghostPostId: result.id,
      ghostUrl: result.url,
      publishedAsDraft: result.status !== "published",
      syncedAt: new Date(),
    });

    if (result.status === "published") {
      await db
        .update(posts)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(posts.id, postId));
    }

    return NextResponse.json(
      {
        ghostPostId: result.id,
        ghostUrl: result.url,
        status: result.status,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof GhostApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish to Ghost" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    postId,
    workspaceSlug,
    status,
    tags,
    canonicalUrl,
    visibility,
    featureImage,
    customExcerpt,
    authors,
  } = body;

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

  // Publish-gate check: block if unresolved critical risk flags exist
  const flags = post.riskFlags ?? [];
  const gateResult = canPublish(flags);

  if (!gateResult.allowed) {
    if (!body.overrideRiskFlags) {
      return NextResponse.json(
        {
          error: "unresolved_critical_flags",
          flags: gateResult.blockingFlags,
          requiresOverride: true,
        },
        { status: 409 }
      );
    }

    const overridePolicy = getOverridePolicy("owner");
    if (!overridePolicy.canOverride) {
      return NextResponse.json(
        { error: "Insufficient permissions to override risk flags" },
        { status: 403 }
      );
    }
  }

  const publication = await db.query.ghostPublications.findFirst({
    where: eq(ghostPublications.postId, postId),
    with: { integration: true },
  });

  if (!publication) {
    return NextResponse.json(
      { error: "Post not published to Ghost yet. Use POST to publish first." },
      { status: 404 }
    );
  }

  if (!publication.integration.enabled) {
    return NextResponse.json(
      { error: "Ghost integration is disabled" },
      { status: 400 }
    );
  }

  try {
    const result = await updateGhostPost(
      publication.integration.adminApiKey,
      publication.integration.ghostUrl,
      publication.ghostPostId,
      {
        title: post.title,
        html: post.content,
        status: status ?? (publication.publishedAsDraft ? "draft" : "published"),
        tags: tags ? tags.map((t: string) => ({ name: t })) : [],
        authors: authors ? authors.map((a: string) => ({ email: a })) : undefined,
        canonical_url: canonicalUrl,
        visibility: visibility ?? "public",
        feature_image: featureImage,
        custom_excerpt: customExcerpt,
        updated_at: new Date().toISOString(),
      }
    );

    await db
      .update(ghostPublications)
      .set({
        ghostUrl: result.url,
        publishedAsDraft: result.status !== "published",
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ghostPublications.postId, postId));

    if (result.status === "published") {
      await db
        .update(posts)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(posts.id, postId));
    }

    return NextResponse.json({
      ghostPostId: result.id,
      ghostUrl: result.url,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof GhostApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update Ghost post" },
      { status: 500 }
    );
  }
}
