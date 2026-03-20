import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postStyleMetrics, posts } from "@sessionforge/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/writing-coach/analytics
 *
 * Retrieves aggregated writing coach analytics for a workspace.
 *
 * Query params:
 * - workspace: workspace slug (required)
 * - timeframe: 7d|30d|90d (optional, defaults to 30d)
 *
 * Returns comprehensive analytics including aggregates, trends, AI patterns, and recent posts.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceSlug = searchParams.get("workspace");
  const timeframe = searchParams.get("timeframe") || "30d";

  if (!workspaceSlug) {
    return NextResponse.json(
      { error: "Missing workspace parameter" },
      { status: 400 }
    );
  }

  // Validate timeframe
  if (!["7d", "30d", "90d"].includes(timeframe)) {
    return NextResponse.json(
      { error: "Invalid timeframe. Must be 7d, 30d, or 90d" },
      { status: 400 }
    );
  }

  // Look up workspace with RBAC
  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.CONTENT_READ
  );

  const wsId = workspace.id;

  // Calculate date threshold based on timeframe
  const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[timeframe];
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  // Query postStyleMetrics joined with posts for the workspace, filtered by date range
  const metrics = await db
    .select({
      id: postStyleMetrics.id,
      postId: postStyleMetrics.postId,
      readabilityScore: postStyleMetrics.readabilityScore,
      authenticityScore: postStyleMetrics.authenticityScore,
      vocabDiversity: postStyleMetrics.vocabDiversity,
      passiveVoicePct: postStyleMetrics.passiveVoicePct,
      aiPatternCount: postStyleMetrics.aiPatternCount,
      aiPatternMatches: postStyleMetrics.aiPatternMatches,
      voiceConsistencyScore: postStyleMetrics.voiceConsistencyScore,
      analyzedAt: postStyleMetrics.analyzedAt,
      postTitle: posts.title,
      postCreatedAt: posts.createdAt,
    })
    .from(postStyleMetrics)
    .innerJoin(posts, eq(postStyleMetrics.postId, posts.id))
    .where(
      and(
        eq(postStyleMetrics.workspaceId, wsId),
        gte(postStyleMetrics.analyzedAt, dateThreshold)
      )
    )
    .orderBy(desc(postStyleMetrics.analyzedAt));

  // Calculate aggregates
  const postsAnalyzed = metrics.length;

  let avgReadability = 0;
  let avgAuthenticityScore = 0;
  let avgVocabDiversity = 0;
  let avgPassiveVoicePct = 0;
  let totalAiPatternHits = 0;
  let voiceConsistencyAvg = 0;
  let voiceConsistencyCount = 0;

  if (postsAnalyzed > 0) {
    for (const metric of metrics) {
      avgReadability += metric.readabilityScore || 0;
      avgAuthenticityScore += metric.authenticityScore || 0;
      avgVocabDiversity += metric.vocabDiversity || 0;
      avgPassiveVoicePct += metric.passiveVoicePct || 0;
      totalAiPatternHits += metric.aiPatternCount || 0;

      if (metric.voiceConsistencyScore !== null) {
        voiceConsistencyAvg += metric.voiceConsistencyScore;
        voiceConsistencyCount++;
      }
    }

    avgReadability = Math.round(avgReadability / postsAnalyzed);
    avgAuthenticityScore = Math.round(avgAuthenticityScore / postsAnalyzed);
    avgVocabDiversity = Number((avgVocabDiversity / postsAnalyzed).toFixed(2));
    avgPassiveVoicePct = Math.round(avgPassiveVoicePct / postsAnalyzed);
    voiceConsistencyAvg = voiceConsistencyCount > 0
      ? Math.round(voiceConsistencyAvg / voiceConsistencyCount)
      : 0;
  }

  // Extract and aggregate AI patterns
  const patternCounts = new Map<string, { category: string; count: number }>();

  for (const metric of metrics) {
    if (metric.aiPatternMatches && Array.isArray(metric.aiPatternMatches)) {
      for (const match of metric.aiPatternMatches) {
        const existing = patternCounts.get(match.phrase);
        if (existing) {
          existing.count++;
        } else {
          patternCounts.set(match.phrase, {
            category: match.category,
            count: 1,
          });
        }
      }
    }
  }

  const topAiPatterns = Array.from(patternCounts.entries())
    .map(([phrase, { category, count }]) => ({ phrase, category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Generate trend data (daily rollups for the timeframe)
  const trendData: Array<{
    date: string;
    avgAuthenticityScore: number;
    avgReadability: number;
    aiPatternHits: number;
  }> = [];

  // Group metrics by date
  const metricsByDate = new Map<string, typeof metrics>();

  for (const metric of metrics) {
    if (metric.analyzedAt) {
      const dateKey = metric.analyzedAt.toISOString().split("T")[0];
      const existing = metricsByDate.get(dateKey);
      if (existing) {
        existing.push(metric);
      } else {
        metricsByDate.set(dateKey, [metric]);
      }
    }
  }

  // Calculate daily averages
  for (const [date, dayMetrics] of metricsByDate.entries()) {
    const count = dayMetrics.length;
    let authSum = 0;
    let readSum = 0;
    let aiSum = 0;

    for (const m of dayMetrics) {
      authSum += m.authenticityScore || 0;
      readSum += m.readabilityScore || 0;
      aiSum += m.aiPatternCount || 0;
    }

    trendData.push({
      date,
      avgAuthenticityScore: Math.round(authSum / count),
      avgReadability: Math.round(readSum / count),
      aiPatternHits: aiSum,
    });
  }

  // Sort trend data by date ascending
  trendData.sort((a, b) => a.date.localeCompare(b.date));

  // Get recent posts with their scores
  const recentPosts = metrics
    .slice(0, 5)
    .map((metric) => {
      // Determine grade from authenticity score
      const score = metric.authenticityScore || 0;
      let grade: "A" | "B" | "C" | "D" | "F";
      if (score >= 90) grade = "A";
      else if (score >= 80) grade = "B";
      else if (score >= 70) grade = "C";
      else if (score >= 60) grade = "D";
      else grade = "F";

      // Determine top issue
      let topIssue = "No issues detected";
      if (metric.aiPatternCount && metric.aiPatternCount > 5) {
        topIssue = `${metric.aiPatternCount} AI patterns detected`;
      } else if (metric.passiveVoicePct && metric.passiveVoicePct > 20) {
        topIssue = `High passive voice (${metric.passiveVoicePct}%)`;
      } else if (metric.vocabDiversity && metric.vocabDiversity < 0.4) {
        topIssue = "Low vocabulary diversity";
      } else if (metric.readabilityScore && metric.readabilityScore < 50) {
        topIssue = "Low readability score";
      }

      return {
        id: metric.postId,
        title: metric.postTitle,
        authenticityScore: metric.authenticityScore || 0,
        grade,
        topIssue,
      };
    });

  // Industry benchmarks for developer content
  const benchmarks = {
    readability: 68,
    vocabDiversity: 0.55,
    passiveVoicePct: 8,
    authenticityScore: 72,
  };

  return NextResponse.json({
    aggregates: {
      avgReadability,
      avgAuthenticityScore,
      avgVocabDiversity,
      avgPassiveVoicePct,
      totalAiPatternHits,
      postsAnalyzed,
      voiceConsistencyAvg,
    },
    topAiPatterns,
    trendData,
    recentPosts,
    benchmarks,
  });
}
