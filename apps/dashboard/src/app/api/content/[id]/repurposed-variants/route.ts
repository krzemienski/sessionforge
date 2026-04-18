import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = {
  bucket: "repurposed-variants",
  limit: 60,
  windowSeconds: 60,
};

export interface RepurposedVariant {
  id: string;
  title: string;
  contentType: string;
  status: string;
  createdAt: string;
}

export interface RepurposeData {
  /** Derived posts created from this post */
  variants: RepurposedVariant[];
  /** Parent post if this is a derivative */
  parentPost: RepurposedVariant | null;
}

/**
 * GET /api/content/[id]/repurposed-variants
 *
 * Returns repurposing information for a post:
 * - variants: posts derived from this post (where parentPostId = this id)
 * - parentPost: the source post if this is a derivative (if this.parentPostId is set)
 *
 * Public endpoint for transparency - no auth required.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limit = await checkRateLimit(request, RATE_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(limit, RATE_LIMIT) },
    );
  }

  const { id } = await params;

  const currentPost = await db.query.posts.findFirst({
    where: eq(posts.id, id),
  });

  if (!currentPost) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404, headers: rateLimitHeaders(limit, RATE_LIMIT) },
    );
  }

  // Query derived posts (posts that have this post as parent)
  const derivedPosts = await db.query.posts.findMany({
    where: eq(posts.parentPostId, id),
    orderBy: (posts, { desc }) => [desc(posts.createdAt)],
  });

  const variants: RepurposedVariant[] = derivedPosts.map((post) => ({
    id: post.id,
    title: post.title,
    contentType: post.contentType,
    status: post.status ?? "draft",
    createdAt: post.createdAt?.toISOString() ?? new Date().toISOString(),
  }));

  // Query parent post if this is a derivative
  let parentPost: RepurposedVariant | null = null;
  if (currentPost.parentPostId) {
    const parent = await db.query.posts.findFirst({
      where: eq(posts.id, currentPost.parentPostId),
    });

    if (parent) {
      parentPost = {
        id: parent.id,
        title: parent.title,
        contentType: parent.contentType,
        status: parent.status ?? "draft",
        createdAt: parent.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    }
  }

  const data: RepurposeData = {
    variants,
    parentPost,
  };

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
      ...rateLimitHeaders(limit, RATE_LIMIT),
    },
  });
}
