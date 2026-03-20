import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postPerformanceMetrics, workspaces, insights } from "@sessionforge/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.ANALYTICS_READ
  );

  try {
    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : undefined;

    // Fetch all workspace posts with their performance metrics and linked insights
    const workspacePosts = await db.query.posts.findMany({
      where: eq(posts.workspaceId, workspace.id),
      with: {
        performanceMetrics: true,
        insight: true,
      },
    });

    // Filter metrics by date range if provided
    const allMetrics = workspacePosts.flatMap((post) => {
      const metrics = post.performanceMetrics.filter((m) => {
        if (fromDate && m.recordedAt && m.recordedAt < fromDate) return false;
        if (toDate && m.recordedAt && m.recordedAt > toDate) return false;
        return true;
      });
      return metrics.map((m) => ({ ...m, post }));
    });

    // Overall overview
    const publishedPosts = workspacePosts.filter((p) => p.status === "published").length;
    const totalViews = allMetrics.reduce((sum, m) => sum + m.views, 0);
    const totalLikes = allMetrics.reduce((sum, m) => sum + m.likes, 0);
    const totalComments = allMetrics.reduce((sum, m) => sum + m.comments, 0);
    const totalShares = allMetrics.reduce((sum, m) => sum + m.shares, 0);
    const avgEngagementRate =
      allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.engagementRate, 0) / allMetrics.length
        : 0;

    const overview = {
      totalPosts: workspacePosts.length,
      publishedPosts,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      avgEngagementRate,
    };

    // Aggregate by content type
    const contentTypeMap: Record<
      string,
      { postCount: number; views: number; likes: number; comments: number; shares: number; totalEngagementRate: number; metricCount: number }
    > = {};

    for (const post of workspacePosts) {
      const type = post.contentType;
      if (!contentTypeMap[type]) {
        contentTypeMap[type] = { postCount: 0, views: 0, likes: 0, comments: 0, shares: 0, totalEngagementRate: 0, metricCount: 0 };
      }
      contentTypeMap[type].postCount += 1;

      for (const m of post.performanceMetrics) {
        if (fromDate && m.recordedAt && m.recordedAt < fromDate) continue;
        if (toDate && m.recordedAt && m.recordedAt > toDate) continue;
        contentTypeMap[type].views += m.views;
        contentTypeMap[type].likes += m.likes;
        contentTypeMap[type].comments += m.comments;
        contentTypeMap[type].shares += m.shares;
        contentTypeMap[type].totalEngagementRate += m.engagementRate;
        contentTypeMap[type].metricCount += 1;
      }
    }

    const byContentType = Object.entries(contentTypeMap).map(([contentType, data]) => ({
      contentType,
      postCount: data.postCount,
      views: data.views,
      likes: data.likes,
      comments: data.comments,
      shares: data.shares,
      avgEngagementRate: data.metricCount > 0 ? data.totalEngagementRate / data.metricCount : 0,
    }));

    // Aggregate by insight category
    const categoryMap: Record<
      string,
      { postCount: number; totalCompositeScore: number; scoreCount: number; views: number; likes: number; comments: number; shares: number; totalEngagementRate: number; metricCount: number }
    > = {};

    for (const post of workspacePosts) {
      if (!post.insight) continue;
      const category = post.insight.category;
      if (!categoryMap[category]) {
        categoryMap[category] = { postCount: 0, totalCompositeScore: 0, scoreCount: 0, views: 0, likes: 0, comments: 0, shares: 0, totalEngagementRate: 0, metricCount: 0 };
      }
      categoryMap[category].postCount += 1;
      categoryMap[category].totalCompositeScore += post.insight.compositeScore;
      categoryMap[category].scoreCount += 1;

      for (const m of post.performanceMetrics) {
        if (fromDate && m.recordedAt && m.recordedAt < fromDate) continue;
        if (toDate && m.recordedAt && m.recordedAt > toDate) continue;
        categoryMap[category].views += m.views;
        categoryMap[category].likes += m.likes;
        categoryMap[category].comments += m.comments;
        categoryMap[category].shares += m.shares;
        categoryMap[category].totalEngagementRate += m.engagementRate;
        categoryMap[category].metricCount += 1;
      }
    }

    const byCategory = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      postCount: data.postCount,
      avgCompositeScore: data.scoreCount > 0 ? data.totalCompositeScore / data.scoreCount : 0,
      views: data.views,
      likes: data.likes,
      comments: data.comments,
      shares: data.shares,
      avgEngagementRate: data.metricCount > 0 ? data.totalEngagementRate / data.metricCount : 0,
    }));

    // Aggregate by word count ranges: short (<500), medium (500-1500), long (>1500)
    const wordCountRanges = [
      { label: "short", min: 0, max: 499 },
      { label: "medium", min: 500, max: 1499 },
      { label: "long", min: 1500, max: Infinity },
    ];

    const wordCountMap: Record<
      string,
      { postCount: number; totalViews: number; totalEngagementRate: number; metricCount: number }
    > = {};

    for (const range of wordCountRanges) {
      wordCountMap[range.label] = { postCount: 0, totalViews: 0, totalEngagementRate: 0, metricCount: 0 };
    }

    for (const post of workspacePosts) {
      const wordCount = post.wordCount ?? 0;
      const range = wordCountRanges.find((r) => wordCount >= r.min && wordCount <= r.max);
      if (!range) continue;

      wordCountMap[range.label].postCount += 1;

      for (const m of post.performanceMetrics) {
        if (fromDate && m.recordedAt && m.recordedAt < fromDate) continue;
        if (toDate && m.recordedAt && m.recordedAt > toDate) continue;
        wordCountMap[range.label].totalViews += m.views;
        wordCountMap[range.label].totalEngagementRate += m.engagementRate;
        wordCountMap[range.label].metricCount += 1;
      }
    }

    const byWordCountRange = wordCountRanges.map((range) => {
      const data = wordCountMap[range.label];
      return {
        range: range.label,
        wordCountMin: range.min,
        wordCountMax: range.max === Infinity ? null : range.max,
        postCount: data.postCount,
        avgViews: data.metricCount > 0 ? data.totalViews / data.metricCount : 0,
        avgEngagementRate: data.metricCount > 0 ? data.totalEngagementRate / data.metricCount : 0,
      };
    });

    // Aggregate by tone
    const toneMap: Record<
      string,
      { postCount: number; views: number; likes: number; comments: number; shares: number; totalEngagementRate: number; metricCount: number }
    > = {};

    for (const post of workspacePosts) {
      const tone = post.toneUsed ?? "unknown";
      if (!toneMap[tone]) {
        toneMap[tone] = { postCount: 0, views: 0, likes: 0, comments: 0, shares: 0, totalEngagementRate: 0, metricCount: 0 };
      }
      toneMap[tone].postCount += 1;

      for (const m of post.performanceMetrics) {
        if (fromDate && m.recordedAt && m.recordedAt < fromDate) continue;
        if (toDate && m.recordedAt && m.recordedAt > toDate) continue;
        toneMap[tone].views += m.views;
        toneMap[tone].likes += m.likes;
        toneMap[tone].comments += m.comments;
        toneMap[tone].shares += m.shares;
        toneMap[tone].totalEngagementRate += m.engagementRate;
        toneMap[tone].metricCount += 1;
      }
    }

    const byTone = Object.entries(toneMap).map(([tone, data]) => ({
      tone,
      postCount: data.postCount,
      views: data.views,
      likes: data.likes,
      comments: data.comments,
      shares: data.shares,
      avgEngagementRate: data.metricCount > 0 ? data.totalEngagementRate / data.metricCount : 0,
    }));

    // Top performing posts (by total views across all metrics)
    const postTotals = workspacePosts
      .map((post) => {
        const filteredMetrics = post.performanceMetrics.filter((m) => {
          if (fromDate && m.recordedAt && m.recordedAt < fromDate) return false;
          if (toDate && m.recordedAt && m.recordedAt > toDate) return false;
          return true;
        });

        const views = filteredMetrics.reduce((sum, m) => sum + m.views, 0);
        const likes = filteredMetrics.reduce((sum, m) => sum + m.likes, 0);
        const comments = filteredMetrics.reduce((sum, m) => sum + m.comments, 0);
        const shares = filteredMetrics.reduce((sum, m) => sum + m.shares, 0);
        const avgEngagementRate =
          filteredMetrics.length > 0
            ? filteredMetrics.reduce((sum, m) => sum + m.engagementRate, 0) / filteredMetrics.length
            : 0;

        return {
          postId: post.id,
          title: post.title,
          contentType: post.contentType,
          status: post.status,
          views,
          likes,
          comments,
          shares,
          avgEngagementRate,
        };
      })
      .filter((p) => p.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return NextResponse.json({
      workspace: workspaceSlug,
      period: {
        from: fromParam ?? null,
        to: toParam ?? null,
      },
      overview,
      byContentType,
      byCategory,
      byWordCountRange,
      byTone,
      topPosts: postTotals,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
