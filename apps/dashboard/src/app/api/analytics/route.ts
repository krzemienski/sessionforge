import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, workspaces, engagementMetrics } from "@sessionforge/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const daysBack = parseInt(searchParams.get("daysBack") ?? "90", 10);

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Get all published posts in the time window
    const publishedPosts = await db.query.posts.findMany({
      where: and(
        eq(posts.workspaceId, workspace.id),
        eq(posts.status, "published"),
        gte(posts.createdAt, cutoffDate)
      ),
      orderBy: [desc(posts.createdAt)],
      with: {
        engagementMetrics: true,
      },
    });

    // Calculate publishing cadence
    const totalPosts = publishedPosts.length;
    const daysInPeriod = daysBack;
    const weeksInPeriod = daysInPeriod / 7;
    const postsPerWeek = weeksInPeriod > 0 ? totalPosts / weeksInPeriod : 0;

    // Group posts by week to identify gaps
    const weeklyPostCount: Record<string, number> = {};
    const dayOfWeekCount: Record<string, number> = {
      "0": 0, // Sunday
      "1": 0, // Monday
      "2": 0, // Tuesday
      "3": 0, // Wednesday
      "4": 0, // Thursday
      "5": 0, // Friday
      "6": 0, // Saturday
    };

    publishedPosts.forEach((post) => {
      const postDate = new Date(post.createdAt ?? Date.now());
      const weekKey = getWeekKey(postDate);
      const dayOfWeek = postDate.getDay().toString();

      weeklyPostCount[weekKey] = (weeklyPostCount[weekKey] || 0) + 1;
      dayOfWeekCount[dayOfWeek] = (dayOfWeekCount[dayOfWeek] || 0) + 1;
    });

    // Identify gaps (weeks with 0 posts)
    const gaps: { weekStart: string; weekEnd: string }[] = [];
    const currentDate = new Date();

    for (let i = 0; i < Math.floor(weeksInPeriod); i++) {
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
      const weekKey = getWeekKey(weekStart);

      if (!weeklyPostCount[weekKey] || weeklyPostCount[weekKey] === 0) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        gaps.push({
          weekStart: weekStart.toISOString().split("T")[0],
          weekEnd: weekEnd.toISOString().split("T")[0],
        });
      }
    }

    // Calculate engagement metrics
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalEngagementRate = 0;
    let metricsCount = 0;

    const contentTypeMetrics: Record<string, {
      count: number;
      avgEngagement: number;
      totalEngagement: number;
    }> = {};

    const hourlyMetrics: Record<string, {
      count: number;
      avgEngagement: number;
    }> = {};

    publishedPosts.forEach((post) => {
      const metrics = post.engagementMetrics;

      if (metrics) {
        totalViews += metrics.views ?? 0;
        totalLikes += metrics.likes ?? 0;
        totalComments += metrics.comments ?? 0;
        totalShares += metrics.shares ?? 0;
        totalEngagementRate += metrics.engagementRate ?? 0;
        metricsCount++;

        // Track by content type
        if (!contentTypeMetrics[post.contentType]) {
          contentTypeMetrics[post.contentType] = {
            count: 0,
            avgEngagement: 0,
            totalEngagement: 0,
          };
        }
        contentTypeMetrics[post.contentType].count++;
        contentTypeMetrics[post.contentType].totalEngagement += metrics.engagementRate ?? 0;
        contentTypeMetrics[post.contentType].avgEngagement =
          contentTypeMetrics[post.contentType].totalEngagement /
          contentTypeMetrics[post.contentType].count;

        // Track by hour of day
        if (metrics.publishedAt) {
          const hour = new Date(metrics.publishedAt).getHours().toString();
          if (!hourlyMetrics[hour]) {
            hourlyMetrics[hour] = { count: 0, avgEngagement: 0 };
          }
          const prevTotal = hourlyMetrics[hour].avgEngagement * hourlyMetrics[hour].count;
          hourlyMetrics[hour].count++;
          hourlyMetrics[hour].avgEngagement =
            (prevTotal + (metrics.engagementRate ?? 0)) / hourlyMetrics[hour].count;
        }
      }
    });

    const avgEngagementRate = metricsCount > 0 ? totalEngagementRate / metricsCount : 0;

    // Find best performing content type
    let bestContentType = null;
    let bestContentTypeEngagement = 0;

    Object.entries(contentTypeMetrics).forEach(([type, data]) => {
      if (data.avgEngagement > bestContentTypeEngagement) {
        bestContentType = type;
        bestContentTypeEngagement = data.avgEngagement;
      }
    });

    // Find best publishing hours (top 3)
    const bestPublishingHours = Object.entries(hourlyMetrics)
      .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)
      .slice(0, 3)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgEngagement: data.avgEngagement,
        postCount: data.count,
      }));

    // Calculate publishing consistency (standard deviation of weekly posts)
    const weeklyValues = Object.values(weeklyPostCount);
    const avgWeeklyPosts = weeklyValues.reduce((sum, val) => sum + val, 0) / Math.max(weeklyValues.length, 1);
    const variance = weeklyValues.reduce((sum, val) => sum + Math.pow(val - avgWeeklyPosts, 2), 0) / Math.max(weeklyValues.length, 1);
    const consistency = Math.sqrt(variance);

    return NextResponse.json({
      cadence: {
        totalPosts,
        daysAnalyzed: daysInPeriod,
        postsPerWeek: parseFloat(postsPerWeek.toFixed(2)),
        avgWeeklyPosts: parseFloat(avgWeeklyPosts.toFixed(2)),
        consistency: parseFloat(consistency.toFixed(2)),
        mostActiveDay: getMostActiveDay(dayOfWeekCount),
        dayOfWeekDistribution: dayOfWeekCount,
      },
      gaps: {
        count: gaps.length,
        recentGaps: gaps.slice(0, 4),
      },
      engagement: {
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
        bestContentType,
        bestContentTypeEngagement: parseFloat(bestContentTypeEngagement.toFixed(2)),
        bestPublishingHours,
        contentTypeBreakdown: contentTypeMetrics,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute analytics" },
      { status: 500 }
    );
  }
}

// Helper function to get week key (ISO week)
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

// Helper function to get most active day
function getMostActiveDay(dayOfWeekCount: Record<string, number>): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let maxDay = "0";
  let maxCount = 0;

  Object.entries(dayOfWeekCount).forEach(([day, count]) => {
    if (count > maxCount) {
      maxDay = day;
      maxCount = count;
    }
  });

  return days[parseInt(maxDay)];
}
