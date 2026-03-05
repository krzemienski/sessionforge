import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { series, seriesPosts, posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify series exists and user owns it
  const seriesItem = await db.query.series.findFirst({
    where: eq(series.id, id),
    with: {
      workspace: true,
    },
  });

  if (!seriesItem) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  if (seriesItem.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { postId, position } = body;

  if (!postId || position === undefined) {
    return NextResponse.json(
      { error: "postId and position are required" },
      { status: 400 }
    );
  }

  // Verify post exists and belongs to same workspace
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspaceId !== seriesItem.workspaceId) {
    return NextResponse.json(
      { error: "Post must belong to the same workspace as the series" },
      { status: 400 }
    );
  }

  // Check if post is already in another series
  // (posts can only be in one series but multiple collections per spec)
  const existingSeriesPost = await db.query.seriesPosts.findFirst({
    where: eq(seriesPosts.postId, postId),
    with: {
      series: true,
    },
  });

  if (existingSeriesPost) {
    return NextResponse.json(
      {
        error: `Post is already in series "${existingSeriesPost.series.title}". A post can only belong to one series.`,
      },
      { status: 409 }
    );
  }

  try {
    const [newSeriesPost] = await db
      .insert(seriesPosts)
      .values({
        seriesId: id,
        postId,
        order: position,
      })
      .returning();

    return NextResponse.json(newSeriesPost, { status: 201 });
  } catch (error) {
    // Handle unique constraint violation (post already in this series)
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json(
        { error: "Post is already in this series" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add post to series" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify series exists and user owns it
  const seriesItem = await db.query.series.findFirst({
    where: eq(series.id, id),
    with: {
      workspace: true,
    },
  });

  if (!seriesItem) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  if (seriesItem.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get postId from query params or body
  const { searchParams } = new URL(request.url);
  const postIdFromQuery = searchParams.get("postId");

  let postId = postIdFromQuery;

  // If not in query params, check request body
  if (!postId) {
    try {
      const body = await request.json();
      postId = body.postId;
    } catch {
      // Body parsing failed, postId remains undefined
    }
  }

  if (!postId) {
    return NextResponse.json(
      { error: "postId is required (as query param or in request body)" },
      { status: 400 }
    );
  }

  // Verify the post is actually in this series
  const existingSeriesPost = await db.query.seriesPosts.findFirst({
    where: and(eq(seriesPosts.seriesId, id), eq(seriesPosts.postId, postId)),
  });

  if (!existingSeriesPost) {
    return NextResponse.json(
      { error: "Post is not in this series" },
      { status: 404 }
    );
  }

  await db
    .delete(seriesPosts)
    .where(and(eq(seriesPosts.seriesId, id), eq(seriesPosts.postId, postId)));

  return NextResponse.json({ deleted: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify series exists and user owns it
  const seriesItem = await db.query.series.findFirst({
    where: eq(series.id, id),
    with: {
      workspace: true,
    },
  });

  if (!seriesItem) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  if (seriesItem.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { postIds } = body;

  if (!postIds || !Array.isArray(postIds)) {
    return NextResponse.json(
      { error: "postIds array is required" },
      { status: 400 }
    );
  }

  // Get all posts currently in this series
  const existingSeriesPosts = await db.query.seriesPosts.findMany({
    where: eq(seriesPosts.seriesId, id),
  });

  // Validate that all provided postIds are actually in this series
  const existingPostIds = new Set(existingSeriesPosts.map((sp) => sp.postId));
  const invalidPostIds = postIds.filter((postId) => !existingPostIds.has(postId));

  if (invalidPostIds.length > 0) {
    return NextResponse.json(
      {
        error: `The following post IDs are not in this series: ${invalidPostIds.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Check if all posts in the series are included in the reorder
  if (postIds.length !== existingSeriesPosts.length) {
    return NextResponse.json(
      {
        error: `All posts in the series must be included in the reorder. Expected ${existingSeriesPosts.length} posts, got ${postIds.length}`,
      },
      { status: 400 }
    );
  }

  try {
    // Update the order for each post
    const updates = postIds.map((postId, index) =>
      db
        .update(seriesPosts)
        .set({ order: index })
        .where(and(eq(seriesPosts.seriesId, id), eq(seriesPosts.postId, postId)))
    );

    await Promise.all(updates);

    // Return the updated series posts
    const updatedSeriesPosts = await db.query.seriesPosts.findMany({
      where: eq(seriesPosts.seriesId, id),
    });

    return NextResponse.json({ seriesPosts: updatedSeriesPosts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder posts" },
      { status: 500 }
    );
  }
}
