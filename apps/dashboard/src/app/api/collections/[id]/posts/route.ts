import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionPosts, posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify collection exists and user owns it
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, id),
    with: {
      workspace: true,
    },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (collection.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { postId, order } = body;

  if (!postId) {
    return NextResponse.json(
      { error: "postId is required" },
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

  if (post.workspaceId !== collection.workspaceId) {
    return NextResponse.json(
      { error: "Post must belong to the same workspace as the collection" },
      { status: 400 }
    );
  }

  try {
    const [newCollectionPost] = await db
      .insert(collectionPosts)
      .values({
        collectionId: id,
        postId,
        order: order ?? 0,
      })
      .returning();

    return NextResponse.json(newCollectionPost, { status: 201 });
  } catch (error) {
    // Handle unique constraint violation (post already in this collection)
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json(
        { error: "Post is already in this collection" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add post to collection" },
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

  // Verify collection exists and user owns it
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, id),
    with: {
      workspace: true,
    },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (collection.workspace.ownerId !== session.user.id) {
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

  // Verify the post is actually in this collection
  const existingCollectionPost = await db.query.collectionPosts.findFirst({
    where: and(eq(collectionPosts.collectionId, id), eq(collectionPosts.postId, postId)),
  });

  if (!existingCollectionPost) {
    return NextResponse.json(
      { error: "Post is not in this collection" },
      { status: 404 }
    );
  }

  await db
    .delete(collectionPosts)
    .where(and(eq(collectionPosts.collectionId, id), eq(collectionPosts.postId, postId)));

  return NextResponse.json({ deleted: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify collection exists and user owns it
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, id),
    with: {
      workspace: true,
    },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (collection.workspace.ownerId !== session.user.id) {
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

  // Get all posts currently in this collection
  const existingCollectionPosts = await db.query.collectionPosts.findMany({
    where: eq(collectionPosts.collectionId, id),
  });

  // Validate that all provided postIds are actually in this collection
  const existingPostIds = new Set(existingCollectionPosts.map((cp) => cp.postId));
  const invalidPostIds = postIds.filter((postId) => !existingPostIds.has(postId));

  if (invalidPostIds.length > 0) {
    return NextResponse.json(
      {
        error: `The following post IDs are not in this collection: ${invalidPostIds.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Check if all posts in the collection are included in the reorder
  if (postIds.length !== existingCollectionPosts.length) {
    return NextResponse.json(
      {
        error: `All posts in the collection must be included in the reorder. Expected ${existingCollectionPosts.length} posts, got ${postIds.length}`,
      },
      { status: 400 }
    );
  }

  try {
    // Update the order for each post
    const updates = postIds.map((postId, index) =>
      db
        .update(collectionPosts)
        .set({ order: index })
        .where(and(eq(collectionPosts.collectionId, id), eq(collectionPosts.postId, postId)))
    );

    await Promise.all(updates);

    // Return the updated collection posts
    const updatedCollectionPosts = await db.query.collectionPosts.findMany({
      where: eq(collectionPosts.collectionId, id),
    });

    return NextResponse.json({ collectionPosts: updatedCollectionPosts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder posts" },
      { status: 500 }
    );
  }
}
