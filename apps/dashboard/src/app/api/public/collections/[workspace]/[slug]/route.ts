import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, workspaces, collectionPosts, posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; slug: string }> }
) {
  const { workspace: workspaceSlug, slug: collectionSlug } = await params;

  // Look up workspace by slug
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Look up collection by workspace + slug
  const collection = await db.query.collections.findFirst({
    where: and(
      eq(collections.workspaceId, workspace.id),
      eq(collections.slug, collectionSlug)
    ),
  });

  if (!collection || !collection.isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get published posts in this collection
  const collectionPostsData = await db.query.collectionPosts.findMany({
    where: eq(collectionPosts.collectionId, collection.id),
    orderBy: (cp, { asc }) => [asc(cp.order)],
    with: {
      post: true,
    },
  });

  const publishedPosts = collectionPostsData
    .map((cp) => cp.post)
    .filter((p) => p.status === "published")
    .map((p) => ({
      id: p.id,
      title: p.title,
      contentType: p.contentType,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
    }));

  return NextResponse.json({
    id: collection.id,
    title: collection.title,
    description: collection.description,
    slug: collection.slug,
    coverImage: collection.coverImage,
    isPublic: collection.isPublic,
    workspaceSlug: workspace.slug,
    posts: publishedPosts,
  });
}
