import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers, postStyleMetrics, posts } from "@sessionforge/db";
import { eq, and, gte, desc, sql, or } from "drizzle-orm";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

interface AiPatternMatch {
  phrase: string;
  category: string;
  suggestion?: string;
}

interface WeeklyDigest {
  postsAnalyzedThisWeek: number;
  avgAuthenticityScoreThisWeek: number | null;
  avgAuthenticityScorePreviousWeek: number | null;
  authenticityScoreChange: number | null;
  topAiPatterns: Array<{
    phrase: string;
    category: string;
    count: number;
    suggestion?: string;
  }>;
  recommendedFocusArea: string;
}

interface WorkspaceDigest {
  id: string;
  slug: string;
  weeklyDigest: WeeklyDigest;
}

/**
 * Computes weekly digest data for a single workspace
 */
async function computeWorkspaceDigest(
  workspaceId: string
): Promise<WeeklyDigest> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get posts analyzed this week
  const thisWeekMetrics = await db
    .select()
    .from(postStyleMetrics)
    .where(
      and(
        eq(postStyleMetrics.workspaceId, workspaceId),
        gte(postStyleMetrics.analyzedAt, oneWeekAgo)
      )
    );

  // Get posts analyzed previous week (for comparison)
  const previousWeekMetrics = await db
    .select()
    .from(postStyleMetrics)
    .where(
      and(
        eq(postStyleMetrics.workspaceId, workspaceId),
        gte(postStyleMetrics.analyzedAt, twoWeeksAgo),
        sql`${postStyleMetrics.analyzedAt} < ${oneWeekAgo}`
      )
    );

  // Calculate avg authenticity scores
  const avgAuthenticityThisWeek =
    thisWeekMetrics.length > 0
      ? thisWeekMetrics.reduce(
          (sum, m) => sum + (m.authenticityScore ?? 0),
          0
        ) / thisWeekMetrics.length
      : null;

  const avgAuthenticityPreviousWeek =
    previousWeekMetrics.length > 0
      ? previousWeekMetrics.reduce(
          (sum, m) => sum + (m.authenticityScore ?? 0),
          0
        ) / previousWeekMetrics.length
      : null;

  const authenticityScoreChange =
    avgAuthenticityThisWeek !== null && avgAuthenticityPreviousWeek !== null
      ? avgAuthenticityThisWeek - avgAuthenticityPreviousWeek
      : null;

  // Aggregate AI patterns across all posts this week
  const aiPatternCounts = new Map<
    string,
    { category: string; count: number; suggestion?: string }
  >();

  for (const metric of thisWeekMetrics) {
    if (metric.aiPatternMatches && Array.isArray(metric.aiPatternMatches)) {
      for (const match of metric.aiPatternMatches as AiPatternMatch[]) {
        const existing = aiPatternCounts.get(match.phrase) ?? {
          category: match.category,
          count: 0,
          suggestion: match.suggestion,
        };
        existing.count += 1;
        aiPatternCounts.set(match.phrase, existing);
      }
    }
  }

  // Get top 3 AI patterns
  const topAiPatterns = Array.from(aiPatternCounts.entries())
    .map(([phrase, data]) => ({
      phrase,
      category: data.category,
      count: data.count,
      suggestion: data.suggestion,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Determine recommended focus area
  const recommendedFocusArea = determineRecommendedFocusArea(
    thisWeekMetrics,
    avgAuthenticityThisWeek
  );

  return {
    postsAnalyzedThisWeek: thisWeekMetrics.length,
    avgAuthenticityScoreThisWeek: avgAuthenticityThisWeek,
    avgAuthenticityScorePreviousWeek: avgAuthenticityPreviousWeek,
    authenticityScoreChange,
    topAiPatterns,
    recommendedFocusArea,
  };
}

/**
 * Determines the recommended focus area based on metrics
 */
function determineRecommendedFocusArea(
  metrics: Array<{
    authenticityScore: number | null;
    vocabDiversity: number | null;
    passiveVoicePct: number | null;
    aiPatternCount: number | null;
    readabilityScore: number | null;
  }>,
  avgAuthenticityScore: number | null
): string {
  if (metrics.length === 0) {
    return "Analyze more posts to get personalized recommendations";
  }

  // Calculate averages for different areas
  const avgVocabDiversity =
    metrics.reduce((sum, m) => sum + (m.vocabDiversity ?? 0), 0) /
    metrics.length;
  const avgPassiveVoice =
    metrics.reduce((sum, m) => sum + (m.passiveVoicePct ?? 0), 0) /
    metrics.length;
  const avgAiPatternCount =
    metrics.reduce((sum, m) => sum + (m.aiPatternCount ?? 0), 0) /
    metrics.length;
  const avgReadability =
    metrics.reduce((sum, m) => sum + (m.readabilityScore ?? 0), 0) /
    metrics.length;

  // Prioritize areas needing improvement
  if (avgAiPatternCount > 5) {
    return "Reduce AI-pattern usage - aim for more authentic phrasing";
  }
  if (avgAuthenticityScore !== null && avgAuthenticityScore < 60) {
    return "Focus on improving overall authenticity score";
  }
  if (avgVocabDiversity < 0.4) {
    return "Expand vocabulary diversity to make your writing more engaging";
  }
  if (avgPassiveVoice > 20) {
    return "Reduce passive voice usage for more direct, engaging writing";
  }
  if (avgReadability < 50) {
    return "Simplify sentence structure to improve readability";
  }

  // If everything is good
  return "Great work! Keep maintaining your authentic writing style";
}

/**
 * GET /api/writing-coach/digest
 *
 * Generates weekly digest data for user workspaces (UI preview mode).
 * Does NOT send email - just returns the data.
 * Query params: workspace (optional slug to scope to a single workspace)
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");

    let targetWorkspaces: Array<{ id: string; slug: string }>;

    if (workspaceSlug) {
      // Single workspace - use RBAC
      const { workspace } = await getAuthorizedWorkspace(
        session,
        workspaceSlug,
        PERMISSIONS.CONTENT_READ
      );
      targetWorkspaces = [{ id: workspace.id, slug: workspace.slug }];
    } else {
      // All owned workspaces (backward compat)
      targetWorkspaces = await db
        .select({
          id: workspaces.id,
          slug: workspaces.slug,
        })
        .from(workspaces)
        .where(eq(workspaces.ownerId, session.user.id));
    }

    const workspaceDigests: WorkspaceDigest[] = [];

    for (const ws of targetWorkspaces) {
      const weeklyDigest = await computeWorkspaceDigest(ws.id);
      workspaceDigests.push({
        id: ws.id,
        slug: ws.slug,
        weeklyDigest,
      });
    }

    return NextResponse.json({ workspaces: workspaceDigests }, { status: 200 });
  } catch (error) {
    console.error("[writing-coach/digest] Error generating digest:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate digest",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/writing-coach/digest
 *
 * Weekly digest endpoint (can be called by QStash or manually).
 * Computes weekly digest for user workspaces and returns the data.
 * In a production implementation, this would also send digest emails.
 * Body params: workspaceSlug (optional - scope to a single workspace)
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const workspaceSlug: string | undefined = body.workspaceSlug;

    let targetWorkspaces: Array<{ id: string; slug: string }>;

    if (workspaceSlug) {
      // Single workspace - use RBAC
      const { workspace } = await getAuthorizedWorkspace(
        session,
        workspaceSlug,
        PERMISSIONS.CONTENT_READ
      );
      targetWorkspaces = [{ id: workspace.id, slug: workspace.slug }];
    } else {
      // All owned workspaces (backward compat)
      targetWorkspaces = await db
        .select({
          id: workspaces.id,
          slug: workspaces.slug,
        })
        .from(workspaces)
        .where(eq(workspaces.ownerId, session.user.id));
    }

    const workspaceDigests: WorkspaceDigest[] = [];

    for (const ws of targetWorkspaces) {
      const weeklyDigest = await computeWorkspaceDigest(ws.id);
      workspaceDigests.push({
        id: ws.id,
        slug: ws.slug,
        weeklyDigest,
      });
    }

    // TODO: Send digest email here
    // In a production implementation, you would:
    // 1. Format the digest data into an HTML email template
    // 2. Send email via your email service (e.g., Resend, SendGrid)
    // 3. Log email send status

    return NextResponse.json(
      {
        success: true,
        workspaces: workspaceDigests,
        message: "Weekly digest generated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[writing-coach/digest] Error generating digest:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate digest",
      },
      { status: 500 }
    );
  }
}
