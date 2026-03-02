import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentMetrics, workspaces, posts } from "@sessionforge/db";
import { eq, and, gte, desc, sum, count, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VALID_WINDOWS = [7, 30, 90] as const;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const windowParam = parseInt(searchParams.get("window") ?? "30", 10);
  const platformParam = searchParams.get("platform");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const windowDays = VALID_WINDOWS.includes(windowParam as (typeof VALID_WINDOWS)[number])
    ? windowParam
    : 30;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - windowDays);

  const metricsConditions = [
    eq(contentMetrics.workspaceId, workspace.id),
    gte(contentMetrics.fetchedAt, startDate),
  ];

  if (platformParam) {
    const validPlatforms = ["devto", "hashnode", "manual"] as const;
    if (validPlatforms.includes(platformParam as (typeof validPlatforms)[number])) {
      metricsConditions.push(
        eq(contentMetrics.platform, platformParam as "devto" | "hashnode" | "manual")
      );
    }
  }

  // Aggregate totals across all metrics in the time window
  const [totals] = await db
    .select({
      totalViews: sum(contentMetrics.views),
      totalReactions: sum(contentMetrics.reactions),
      totalComments: sum(contentMetrics.comments),
      totalLikes: sum(contentMetrics.likes),
    })
    .from(contentMetrics)
    .where(and(...metricsConditions));

  // Top posts sorted by views descending, limit 5
  const topPosts = await db
    .select({
      id: contentMetrics.id,
      postId: contentMetrics.postId,
      platform: contentMetrics.platform,
      title: contentMetrics.title,
      url: contentMetrics.url,
      views: contentMetrics.views,
      reactions: contentMetrics.reactions,
      comments: contentMetrics.comments,
      likes: contentMetrics.likes,
      publishedAt: contentMetrics.publishedAt,
    })
    .from(contentMetrics)
    .where(and(...metricsConditions))
    .orderBy(desc(contentMetrics.views))
    .limit(5);

  // Content type breakdown grouped by platform and post contentType
  const contentTypeBreakdown = await db
    .select({
      platform: contentMetrics.platform,
      contentType: posts.contentType,
      totalViews: sum(contentMetrics.views),
      totalReactions: sum(contentMetrics.reactions),
      totalComments: sum(contentMetrics.comments),
      totalLikes: sum(contentMetrics.likes),
      postCount: count(contentMetrics.id),
    })
    .from(contentMetrics)
    .leftJoin(posts, eq(contentMetrics.postId, posts.id))
    .where(and(...metricsConditions))
    .groupBy(contentMetrics.platform, posts.contentType);

  // Daily time series data for trend charts
  const timeSeriesData = await db
    .select({
      date: sql<string>`DATE(${contentMetrics.fetchedAt})`,
      views: sum(contentMetrics.views),
      reactions: sum(contentMetrics.reactions),
      comments: sum(contentMetrics.comments),
      likes: sum(contentMetrics.likes),
    })
    .from(contentMetrics)
    .where(and(...metricsConditions))
    .groupBy(sql`DATE(${contentMetrics.fetchedAt})`)
    .orderBy(sql`DATE(${contentMetrics.fetchedAt})`);

  // Publishing cadence: posts published per week within the window
  const cadenceStartDate = new Date();
  cadenceStartDate.setDate(cadenceStartDate.getDate() - windowDays);

  const publishingCadence = await db
    .select({
      week: sql<string>`DATE_TRUNC('week', ${posts.createdAt})`,
      postsPublished: count(posts.id),
    })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, workspace.id),
        eq(posts.status, "published"),
        gte(posts.createdAt, cadenceStartDate)
      )
    )
    .groupBy(sql`DATE_TRUNC('week', ${posts.createdAt})`)
    .orderBy(sql`DATE_TRUNC('week', ${posts.createdAt})`);

  return NextResponse.json({
    window: windowDays,
    totalViews: Number(totals?.totalViews ?? 0),
    totalReactions: Number(totals?.totalReactions ?? 0),
    totalComments: Number(totals?.totalComments ?? 0),
    totalLikes: Number(totals?.totalLikes ?? 0),
    topPosts,
    contentTypeBreakdown: contentTypeBreakdown.map((row) => ({
      ...row,
      totalViews: Number(row.totalViews ?? 0),
      totalReactions: Number(row.totalReactions ?? 0),
      totalComments: Number(row.totalComments ?? 0),
      totalLikes: Number(row.totalLikes ?? 0),
    })),
    timeSeriesData: timeSeriesData.map((row) => ({
      ...row,
      views: Number(row.views ?? 0),
      reactions: Number(row.reactions ?? 0),
      comments: Number(row.comments ?? 0),
      likes: Number(row.likes ?? 0),
    })),
    publishingCadence,
  });
}
