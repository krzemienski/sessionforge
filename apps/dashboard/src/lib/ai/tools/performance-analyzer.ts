import { db } from "@/lib/db";
import { postPerformanceMetrics, posts } from "@sessionforge/db";
import { eq, desc, avg, sum, count, and, lt, gte } from "drizzle-orm";
import type { contentTypeEnum, insightCategoryEnum } from "@sessionforge/db";

type ContentType = (typeof contentTypeEnum.enumValues)[number];
type InsightCategory = (typeof insightCategoryEnum.enumValues)[number];

export interface TopicPerformance {
  category: InsightCategory;
  postCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number;
}

export interface FormatPerformance {
  contentType: ContentType;
  postCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number;
}

export interface LengthPerformance {
  bucket: "short" | "medium" | "long";
  wordCountRange: string;
  postCount: number;
  totalViews: number;
  avgEngagementRate: number;
}

export interface PostPerformanceSummary {
  postId: string;
  title: string;
  contentType: ContentType;
  wordCount: number | null;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number;
}

export async function getPerformanceByTopic(
  workspaceId: string
): Promise<TopicPerformance[]> {
  const rows = await db
    .select({
      category: posts.insightId,
      postId: posts.id,
      totalViews: sum(postPerformanceMetrics.views).mapWith(Number),
      totalLikes: sum(postPerformanceMetrics.likes).mapWith(Number),
      totalComments: sum(postPerformanceMetrics.comments).mapWith(Number),
      totalShares: sum(postPerformanceMetrics.shares).mapWith(Number),
      avgEngagementRate: avg(postPerformanceMetrics.engagementRate).mapWith(Number),
    })
    .from(postPerformanceMetrics)
    .innerJoin(posts, eq(postPerformanceMetrics.postId, posts.id))
    .where(eq(posts.workspaceId, workspaceId))
    .groupBy(posts.insightId, posts.id);

  // Group by insightId (used as category proxy) — aggregate across posts
  const grouped = new Map<string, TopicPerformance>();
  for (const row of rows) {
    const key = row.category ?? "uncategorized";
    const existing = grouped.get(key);
    if (existing) {
      existing.postCount += 1;
      existing.totalViews += row.totalViews ?? 0;
      existing.totalLikes += row.totalLikes ?? 0;
      existing.totalComments += row.totalComments ?? 0;
      existing.totalShares += row.totalShares ?? 0;
      existing.avgEngagementRate =
        (existing.avgEngagementRate + (row.avgEngagementRate ?? 0)) / 2;
    } else {
      grouped.set(key, {
        category: key as InsightCategory,
        postCount: 1,
        totalViews: row.totalViews ?? 0,
        totalLikes: row.totalLikes ?? 0,
        totalComments: row.totalComments ?? 0,
        totalShares: row.totalShares ?? 0,
        avgEngagementRate: row.avgEngagementRate ?? 0,
      });
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.avgEngagementRate - a.avgEngagementRate
  );
}

export async function getPerformanceByFormat(
  workspaceId: string
): Promise<FormatPerformance[]> {
  const rows = await db
    .select({
      contentType: posts.contentType,
      totalViews: sum(postPerformanceMetrics.views).mapWith(Number),
      totalLikes: sum(postPerformanceMetrics.likes).mapWith(Number),
      totalComments: sum(postPerformanceMetrics.comments).mapWith(Number),
      totalShares: sum(postPerformanceMetrics.shares).mapWith(Number),
      avgEngagementRate: avg(postPerformanceMetrics.engagementRate).mapWith(Number),
      postCount: count(postPerformanceMetrics.postId),
    })
    .from(postPerformanceMetrics)
    .innerJoin(posts, eq(postPerformanceMetrics.postId, posts.id))
    .where(eq(posts.workspaceId, workspaceId))
    .groupBy(posts.contentType)
    .orderBy(desc(avg(postPerformanceMetrics.engagementRate)));

  return rows.map((row) => ({
    contentType: row.contentType,
    postCount: row.postCount,
    totalViews: row.totalViews ?? 0,
    totalLikes: row.totalLikes ?? 0,
    totalComments: row.totalComments ?? 0,
    totalShares: row.totalShares ?? 0,
    avgEngagementRate: row.avgEngagementRate ?? 0,
  }));
}

export async function getPerformanceByLength(
  workspaceId: string
): Promise<LengthPerformance[]> {
  const SHORT_MAX = 500;
  const MEDIUM_MAX = 1500;

  const allRows = await db
    .select({
      wordCount: posts.wordCount,
      totalViews: sum(postPerformanceMetrics.views).mapWith(Number),
      avgEngagementRate: avg(postPerformanceMetrics.engagementRate).mapWith(Number),
    })
    .from(postPerformanceMetrics)
    .innerJoin(posts, eq(postPerformanceMetrics.postId, posts.id))
    .where(eq(posts.workspaceId, workspaceId))
    .groupBy(posts.wordCount);

  const buckets: Record<
    "short" | "medium" | "long",
    { postCount: number; totalViews: number; engagementRateSum: number; wordCountRange: string }
  > = {
    short: { postCount: 0, totalViews: 0, engagementRateSum: 0, wordCountRange: `0–${SHORT_MAX}` },
    medium: { postCount: 0, totalViews: 0, engagementRateSum: 0, wordCountRange: `${SHORT_MAX + 1}–${MEDIUM_MAX}` },
    long: { postCount: 0, totalViews: 0, engagementRateSum: 0, wordCountRange: `${MEDIUM_MAX + 1}+` },
  };

  for (const row of allRows) {
    const wc = row.wordCount ?? 0;
    const bucket = wc <= SHORT_MAX ? "short" : wc <= MEDIUM_MAX ? "medium" : "long";
    buckets[bucket].postCount += 1;
    buckets[bucket].totalViews += row.totalViews ?? 0;
    buckets[bucket].engagementRateSum += row.avgEngagementRate ?? 0;
  }

  return (["short", "medium", "long"] as const).map((bucket) => ({
    bucket,
    wordCountRange: buckets[bucket].wordCountRange,
    postCount: buckets[bucket].postCount,
    totalViews: buckets[bucket].totalViews,
    avgEngagementRate:
      buckets[bucket].postCount > 0
        ? buckets[bucket].engagementRateSum / buckets[bucket].postCount
        : 0,
  }));
}

export async function getTopPerformingPosts(
  workspaceId: string,
  limit = 10
): Promise<PostPerformanceSummary[]> {
  const rows = await db
    .select({
      postId: posts.id,
      title: posts.title,
      contentType: posts.contentType,
      wordCount: posts.wordCount,
      totalViews: sum(postPerformanceMetrics.views).mapWith(Number),
      totalLikes: sum(postPerformanceMetrics.likes).mapWith(Number),
      totalComments: sum(postPerformanceMetrics.comments).mapWith(Number),
      totalShares: sum(postPerformanceMetrics.shares).mapWith(Number),
      avgEngagementRate: avg(postPerformanceMetrics.engagementRate).mapWith(Number),
    })
    .from(postPerformanceMetrics)
    .innerJoin(posts, eq(postPerformanceMetrics.postId, posts.id))
    .where(eq(posts.workspaceId, workspaceId))
    .groupBy(posts.id, posts.title, posts.contentType, posts.wordCount)
    .orderBy(desc(avg(postPerformanceMetrics.engagementRate)))
    .limit(limit);

  return rows.map((row) => ({
    postId: row.postId,
    title: row.title,
    contentType: row.contentType,
    wordCount: row.wordCount,
    totalViews: row.totalViews ?? 0,
    totalLikes: row.totalLikes ?? 0,
    totalComments: row.totalComments ?? 0,
    totalShares: row.totalShares ?? 0,
    avgEngagementRate: row.avgEngagementRate ?? 0,
  }));
}

export async function getUnderperformingPosts(
  workspaceId: string,
  maxEngagementRate = 0.01,
  limit = 10
): Promise<PostPerformanceSummary[]> {
  const rows = await db
    .select({
      postId: posts.id,
      title: posts.title,
      contentType: posts.contentType,
      wordCount: posts.wordCount,
      totalViews: sum(postPerformanceMetrics.views).mapWith(Number),
      totalLikes: sum(postPerformanceMetrics.likes).mapWith(Number),
      totalComments: sum(postPerformanceMetrics.comments).mapWith(Number),
      totalShares: sum(postPerformanceMetrics.shares).mapWith(Number),
      avgEngagementRate: avg(postPerformanceMetrics.engagementRate).mapWith(Number),
    })
    .from(postPerformanceMetrics)
    .innerJoin(posts, eq(postPerformanceMetrics.postId, posts.id))
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        lt(postPerformanceMetrics.engagementRate, maxEngagementRate)
      )
    )
    .groupBy(posts.id, posts.title, posts.contentType, posts.wordCount)
    .orderBy(avg(postPerformanceMetrics.engagementRate))
    .limit(limit);

  return rows.map((row) => ({
    postId: row.postId,
    title: row.title,
    contentType: row.contentType,
    wordCount: row.wordCount,
    totalViews: row.totalViews ?? 0,
    totalLikes: row.totalLikes ?? 0,
    totalComments: row.totalComments ?? 0,
    totalShares: row.totalShares ?? 0,
    avgEngagementRate: row.avgEngagementRate ?? 0,
  }));
}

// MCP tool definitions
export const performanceAnalyzerTools = [
  {
    name: "get_performance_by_topic",
    description:
      "Analyze content performance grouped by topic/insight category. Returns engagement metrics per category to identify which topics resonate most with the audience.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_performance_by_format",
    description:
      "Analyze content performance grouped by content format (blog, social thread, changelog, etc.). Returns engagement metrics per format to recommend optimal content types.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_performance_by_length",
    description:
      "Analyze content performance grouped by word count bucket (short: 0–500, medium: 501–1500, long: 1501+). Returns engagement metrics per length bucket to recommend optimal post lengths.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_top_performing_posts",
    description:
      "Get top performing posts sorted by average engagement rate. Useful for identifying patterns in high-performing content.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of posts to return (default: 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_underperforming_posts",
    description:
      "Get underperforming posts with low engagement rates. Useful for identifying content that needs improvement or republishing.",
    input_schema: {
      type: "object" as const,
      properties: {
        maxEngagementRate: {
          type: "number",
          description:
            "Maximum engagement rate threshold to classify a post as underperforming (default: 0.01)",
        },
        limit: {
          type: "number",
          description: "Maximum number of posts to return (default: 10)",
        },
      },
      required: [],
    },
  },
];

export async function handlePerformanceAnalyzerTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "get_performance_by_topic":
      return getPerformanceByTopic(workspaceId);
    case "get_performance_by_format":
      return getPerformanceByFormat(workspaceId);
    case "get_performance_by_length":
      return getPerformanceByLength(workspaceId);
    case "get_top_performing_posts":
      return getTopPerformingPosts(
        workspaceId,
        toolInput.limit as number | undefined
      );
    case "get_underperforming_posts":
      return getUnderperformingPosts(
        workspaceId,
        toolInput.maxEngagementRate as number | undefined,
        toolInput.limit as number | undefined
      );
    default:
      throw new Error(`Unknown performance analyzer tool: ${toolName}`);
  }
}
