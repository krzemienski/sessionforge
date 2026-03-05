import { db } from "@/lib/db";
import { posts, engagementMetrics } from "@sessionforge/db";
import { eq, desc, and, gte } from "drizzle-orm";

export interface PublishingCadence {
  totalPosts: number;
  daysAnalyzed: number;
  postsPerWeek: number;
  avgWeeklyPosts: number;
  consistency: number;
  mostActiveDay: string;
  dayOfWeekDistribution: Record<string, number>;
}

export interface CadenceGap {
  weekStart: string;
  weekEnd: string;
}

export interface EngagementMetrics {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number;
  bestContentType: string | null;
  bestContentTypeEngagement: number;
  bestPublishingHours: Array<{
    hour: number;
    avgEngagement: number;
    postCount: number;
  }>;
  contentTypeBreakdown: Record<
    string,
    {
      count: number;
      avgEngagement: number;
      totalEngagement: number;
    }
  >;
}

export interface ContentAnalytics {
  cadence: PublishingCadence;
  gaps: {
    count: number;
    recentGaps: CadenceGap[];
  };
  engagement: EngagementMetrics;
}

export async function getPublishingCadence(
  workspaceId: string,
  daysBack = 90
): Promise<PublishingCadence> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const publishedPosts = await db.query.posts.findMany({
    where: and(
      eq(posts.workspaceId, workspaceId),
      eq(posts.status, "published"),
      gte(posts.createdAt, cutoffDate)
    ),
    orderBy: [desc(posts.createdAt)],
  });

  const totalPosts = publishedPosts.length;
  const daysInPeriod = daysBack;
  const weeksInPeriod = daysInPeriod / 7;
  const postsPerWeek = weeksInPeriod > 0 ? totalPosts / weeksInPeriod : 0;

  const weeklyPostCount: Record<string, number> = {};
  const dayOfWeekCount: Record<string, number> = {
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
  };

  publishedPosts.forEach((post) => {
    const postDate = new Date(post.createdAt ?? Date.now());
    const weekKey = getWeekKey(postDate);
    const dayOfWeek = postDate.getDay().toString();

    weeklyPostCount[weekKey] = (weeklyPostCount[weekKey] || 0) + 1;
    dayOfWeekCount[dayOfWeek] = (dayOfWeekCount[dayOfWeek] || 0) + 1;
  });

  const weeklyValues = Object.values(weeklyPostCount);
  const avgWeeklyPosts =
    weeklyValues.reduce((sum, val) => sum + val, 0) /
    Math.max(weeklyValues.length, 1);
  const variance =
    weeklyValues.reduce((sum, val) => sum + Math.pow(val - avgWeeklyPosts, 2), 0) /
    Math.max(weeklyValues.length, 1);
  const consistency = Math.sqrt(variance);

  return {
    totalPosts,
    daysAnalyzed: daysInPeriod,
    postsPerWeek: parseFloat(postsPerWeek.toFixed(2)),
    avgWeeklyPosts: parseFloat(avgWeeklyPosts.toFixed(2)),
    consistency: parseFloat(consistency.toFixed(2)),
    mostActiveDay: getMostActiveDay(dayOfWeekCount),
    dayOfWeekDistribution: dayOfWeekCount,
  };
}

export async function getCadenceGaps(
  workspaceId: string,
  daysBack = 90
): Promise<CadenceGap[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const publishedPosts = await db.query.posts.findMany({
    where: and(
      eq(posts.workspaceId, workspaceId),
      eq(posts.status, "published"),
      gte(posts.createdAt, cutoffDate)
    ),
    orderBy: [desc(posts.createdAt)],
  });

  const weeklyPostCount: Record<string, number> = {};

  publishedPosts.forEach((post) => {
    const postDate = new Date(post.createdAt ?? Date.now());
    const weekKey = getWeekKey(postDate);
    weeklyPostCount[weekKey] = (weeklyPostCount[weekKey] || 0) + 1;
  });

  const gaps: CadenceGap[] = [];
  const currentDate = new Date();
  const weeksInPeriod = daysBack / 7;

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

  return gaps;
}

export async function getEngagementMetrics(
  workspaceId: string,
  daysBack = 90
): Promise<EngagementMetrics> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const publishedPosts = await db.query.posts.findMany({
    where: and(
      eq(posts.workspaceId, workspaceId),
      eq(posts.status, "published"),
      gte(posts.createdAt, cutoffDate)
    ),
    orderBy: [desc(posts.createdAt)],
    with: {
      engagementMetrics: true,
    },
  });

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalEngagementRate = 0;
  let metricsCount = 0;

  const contentTypeMetrics: Record<
    string,
    {
      count: number;
      avgEngagement: number;
      totalEngagement: number;
    }
  > = {};

  const hourlyMetrics: Record<
    string,
    {
      count: number;
      avgEngagement: number;
    }
  > = {};

  publishedPosts.forEach((post) => {
    const metrics = post.engagementMetrics;

    if (metrics) {
      totalViews += metrics.views ?? 0;
      totalLikes += metrics.likes ?? 0;
      totalComments += metrics.comments ?? 0;
      totalShares += metrics.shares ?? 0;
      totalEngagementRate += metrics.engagementRate ?? 0;
      metricsCount++;

      if (!contentTypeMetrics[post.contentType]) {
        contentTypeMetrics[post.contentType] = {
          count: 0,
          avgEngagement: 0,
          totalEngagement: 0,
        };
      }
      contentTypeMetrics[post.contentType].count++;
      contentTypeMetrics[post.contentType].totalEngagement +=
        metrics.engagementRate ?? 0;
      contentTypeMetrics[post.contentType].avgEngagement =
        contentTypeMetrics[post.contentType].totalEngagement /
        contentTypeMetrics[post.contentType].count;

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

  let bestContentType = null;
  let bestContentTypeEngagement = 0;

  Object.entries(contentTypeMetrics).forEach(([type, data]) => {
    if (data.avgEngagement > bestContentTypeEngagement) {
      bestContentType = type;
      bestContentTypeEngagement = data.avgEngagement;
    }
  });

  const bestPublishingHours = Object.entries(hourlyMetrics)
    .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)
    .slice(0, 3)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      avgEngagement: data.avgEngagement,
      postCount: data.count,
    }));

  return {
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
    bestContentType,
    bestContentTypeEngagement: parseFloat(bestContentTypeEngagement.toFixed(2)),
    bestPublishingHours,
    contentTypeBreakdown: contentTypeMetrics,
  };
}

export async function getContentAnalytics(
  workspaceId: string,
  daysBack = 90
): Promise<ContentAnalytics> {
  const [cadence, gaps, engagement] = await Promise.all([
    getPublishingCadence(workspaceId, daysBack),
    getCadenceGaps(workspaceId, daysBack),
    getEngagementMetrics(workspaceId, daysBack),
  ]);

  return {
    cadence,
    gaps: {
      count: gaps.length,
      recentGaps: gaps.slice(0, 4),
    },
    engagement,
  };
}

// Helper functions
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

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

// MCP tool definitions
export const analyticsTools = [
  {
    name: "get_publishing_cadence",
    description:
      "Get publishing pattern metrics including total posts, posts per week, consistency score, and most active day of the week.",
    input_schema: {
      type: "object" as const,
      properties: {
        daysBack: {
          type: "number",
          description: "Number of days to analyze (default: 90)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_cadence_gaps",
    description:
      "Identify weeks with no published content to detect gaps in publishing cadence.",
    input_schema: {
      type: "object" as const,
      properties: {
        daysBack: {
          type: "number",
          description: "Number of days to analyze (default: 90)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_engagement_metrics",
    description:
      "Get engagement data including views, likes, comments, shares, best performing content types, and optimal publishing hours.",
    input_schema: {
      type: "object" as const,
      properties: {
        daysBack: {
          type: "number",
          description: "Number of days to analyze (default: 90)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_content_analytics",
    description:
      "Get comprehensive analytics including publishing cadence, gaps, and engagement metrics in a single call.",
    input_schema: {
      type: "object" as const,
      properties: {
        daysBack: {
          type: "number",
          description: "Number of days to analyze (default: 90)",
        },
      },
      required: [],
    },
  },
];

export async function handleAnalyticsTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  const daysBack = (toolInput.daysBack as number | undefined) ?? 90;

  switch (toolName) {
    case "get_publishing_cadence":
      return getPublishingCadence(workspaceId, daysBack);
    case "get_cadence_gaps":
      return getCadenceGaps(workspaceId, daysBack);
    case "get_engagement_metrics":
      return getEngagementMetrics(workspaceId, daysBack);
    case "get_content_analytics":
      return getContentAnalytics(workspaceId, daysBack);
    default:
      throw new Error(`Unknown analytics tool: ${toolName}`);
  }
}
