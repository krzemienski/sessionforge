import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postPerformanceMetrics } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { views, likes, comments, shares, platform } = body;

  if (
    views === undefined ||
    likes === undefined ||
    comments === undefined ||
    shares === undefined ||
    !platform
  ) {
    return NextResponse.json(
      { error: "views, likes, comments, shares, and platform are required" },
      { status: 400 }
    );
  }

  try {
    // Calculate engagement rate: (likes + comments + shares) / views
    // Avoid division by zero
    const engagementRate = views > 0 ? (likes + comments + shares) / views : 0;

    const [metric] = await db
      .insert(postPerformanceMetrics)
      .values({
        postId: id,
        views,
        likes,
        comments,
        shares,
        engagementRate,
        platform,
      })
      .returning();

    return NextResponse.json(metric, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record performance metrics" },
      { status: 500 }
    );
  }
}
