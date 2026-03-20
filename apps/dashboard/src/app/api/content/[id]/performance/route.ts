import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postPerformanceMetrics } from "@sessionforge/db";
import { eq, desc } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_EDIT);

    const body = await request.json();
    const { views, likes, comments, shares, platform } = body;

    if (
      views === undefined ||
      likes === undefined ||
      comments === undefined ||
      shares === undefined ||
      !platform
    ) {
      throw new AppError(
        "views, likes, comments, shares, and platform are required",
        ERROR_CODES.BAD_REQUEST
      );
    }

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
  })(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_READ);

    // Fetch all performance metrics for this post
    const metrics = await db.query.postPerformanceMetrics.findMany({
      where: eq(postPerformanceMetrics.postId, id),
      orderBy: [desc(postPerformanceMetrics.recordedAt)],
    });

    // Group by platform and calculate totals
    const byPlatform = metrics.reduce((acc, metric) => {
      if (!acc[metric.platform]) {
        acc[metric.platform] = {
          platform: metric.platform,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          totalEngagementRate: 0,
          count: 0,
          latestRecordedAt: metric.recordedAt,
        };
      }

      const platformData = acc[metric.platform];
      platformData.views += metric.views;
      platformData.likes += metric.likes;
      platformData.comments += metric.comments;
      platformData.shares += metric.shares;
      platformData.totalEngagementRate += metric.engagementRate;
      platformData.count += 1;

      // Update latest timestamp if this record is newer
      if (metric.recordedAt && (!platformData.latestRecordedAt || metric.recordedAt > platformData.latestRecordedAt)) {
        platformData.latestRecordedAt = metric.recordedAt;
      }

      return acc;
    }, {} as Record<string, {
      platform: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      totalEngagementRate: number;
      count: number;
      latestRecordedAt: Date | null;
    }>);

    // Calculate average engagement rate per platform
    const platformSummary = Object.values(byPlatform).map((platformData) => ({
      platform: platformData.platform,
      views: platformData.views,
      likes: platformData.likes,
      comments: platformData.comments,
      shares: platformData.shares,
      avgEngagementRate: platformData.count > 0 ? platformData.totalEngagementRate / platformData.count : 0,
      recordCount: platformData.count,
      latestRecordedAt: platformData.latestRecordedAt,
    }));

    // Calculate overall totals
    const totals = {
      views: metrics.reduce((sum, m) => sum + m.views, 0),
      likes: metrics.reduce((sum, m) => sum + m.likes, 0),
      comments: metrics.reduce((sum, m) => sum + m.comments, 0),
      shares: metrics.reduce((sum, m) => sum + m.shares, 0),
      avgEngagementRate: metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length
        : 0,
    };

    return NextResponse.json({
      postId: id,
      totals,
      byPlatform: platformSummary,
      metrics,
    });
  })(request);
}
