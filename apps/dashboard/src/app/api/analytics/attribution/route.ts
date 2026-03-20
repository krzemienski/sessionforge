import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, contentMetrics, workspaces } from "@sessionforge/db";
import { eq, and, gte, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

function parseTimeframeDays(timeframe: string): number {
  const match = timeframe.match(/^(\d+)d$/);
  if (match) return parseInt(match[1], 10);
  if (timeframe === "7d") return 7;
  if (timeframe === "90d") return 90;
  return 30;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const timeframe = searchParams.get("timeframe") ?? "30d";

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const days = parseTimeframeDays(timeframe);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const workspacePosts = await db.query.posts.findMany({
    where: and(eq(posts.workspaceId, workspace.id), gte(posts.createdAt, since)),
    with: {
      performanceMetrics: true,
      socialAnalytics: true,
    },
  });

  const postIds = workspacePosts.map((p) => p.id);

  const postContentMetrics =
    postIds.length > 0
      ? await db.query.contentMetrics.findMany({
          where: and(
            eq(contentMetrics.workspaceId, workspace.id),
            inArray(contentMetrics.postId, postIds)
          ),
        })
      : [];

  const contentMetricsByPostId: Record<string, typeof postContentMetrics> = {};
  for (const m of postContentMetrics) {
    if (!m.postId) continue;
    if (!contentMetricsByPostId[m.postId]) {
      contentMetricsByPostId[m.postId] = [];
    }
    contentMetricsByPostId[m.postId].push(m);
  }

  const attributionPosts = workspacePosts.map((post) => {
    const sourceSessions = post.sourceMetadata?.sessionIds ?? [];
    const sourceInsights = post.sourceMetadata?.insightIds ?? [];
    const generatedBy = post.sourceMetadata?.generatedBy ?? "manual";

    const channelKpis: Record<
      string,
      { impressions: number; likes: number; shares: number; comments: number; clicks: number }
    > = {};

    for (const sa of post.socialAnalytics) {
      const platform = sa.platform;
      if (!channelKpis[platform]) {
        channelKpis[platform] = { impressions: 0, likes: 0, shares: 0, comments: 0, clicks: 0 };
      }
      channelKpis[platform].impressions += sa.impressions ?? 0;
      channelKpis[platform].likes += sa.likes ?? 0;
      channelKpis[platform].shares += sa.shares ?? 0;
      channelKpis[platform].comments += sa.comments ?? 0;
      channelKpis[platform].clicks += sa.clicks ?? 0;
    }

    const performanceTotals = post.performanceMetrics.reduce(
      (acc, m) => ({
        views: acc.views + m.views,
        likes: acc.likes + m.likes,
        comments: acc.comments + m.comments,
        shares: acc.shares + m.shares,
        totalEngagementRate: acc.totalEngagementRate + m.engagementRate,
        count: acc.count + 1,
      }),
      { views: 0, likes: 0, comments: 0, shares: 0, totalEngagementRate: 0, count: 0 }
    );

    const postCms = contentMetricsByPostId[post.id] ?? [];
    const contentMetricsByPlatform: Record<
      string,
      { views: number; reactions: number; comments: number; likes: number }
    > = {};
    for (const cm of postCms) {
      const p = cm.platform;
      if (!contentMetricsByPlatform[p]) {
        contentMetricsByPlatform[p] = { views: 0, reactions: 0, comments: 0, likes: 0 };
      }
      contentMetricsByPlatform[p].views += cm.views ?? 0;
      contentMetricsByPlatform[p].reactions += cm.reactions ?? 0;
      contentMetricsByPlatform[p].comments += cm.comments ?? 0;
      contentMetricsByPlatform[p].likes += cm.likes ?? 0;
    }

    return {
      postId: post.id,
      title: post.title,
      contentType: post.contentType,
      status: post.status,
      createdAt: post.createdAt,
      publishedAt: post.publishedAt,
      attribution: {
        sourceSessions,
        sourceInsights,
        generatedBy,
        lookbackWindow: post.sourceMetadata?.lookbackWindow ?? null,
        triggerId: post.sourceMetadata?.triggerId ?? null,
      },
      performance: {
        views: performanceTotals.views,
        likes: performanceTotals.likes,
        comments: performanceTotals.comments,
        shares: performanceTotals.shares,
        avgEngagementRate:
          performanceTotals.count > 0
            ? performanceTotals.totalEngagementRate / performanceTotals.count
            : 0,
      },
      channelKpis,
      contentMetrics: contentMetricsByPlatform,
    };
  });

  const totals = attributionPosts.reduce(
    (acc, p) => ({
      totalPosts: acc.totalPosts + 1,
      totalViews: acc.totalViews + p.performance.views,
      totalLikes: acc.totalLikes + p.performance.likes,
      totalComments: acc.totalComments + p.performance.comments,
      totalShares: acc.totalShares + p.performance.shares,
      postsWithSessions:
        acc.postsWithSessions + (p.attribution.sourceSessions.length > 0 ? 1 : 0),
    }),
    { totalPosts: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0, postsWithSessions: 0 }
  );

  return NextResponse.json({
    timeframe,
    since: since.toISOString(),
    totals,
    posts: attributionPosts,
  });
}
