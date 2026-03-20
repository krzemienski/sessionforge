import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postStyleMetrics, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { analyzePostStyle } from "@/lib/writing-coach/style-analyzer";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId } = await params;

  // Fetch the post
  const [post] = await db
    .select({
      id: posts.id,
      workspaceId: posts.workspaceId,
      markdown: posts.markdown,
      editDistance: posts.editDistance,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Verify workspace access via RBAC
  await getAuthorizedWorkspaceById(
    session,
    post.workspaceId,
    PERMISSIONS.CONTENT_READ
  );

  // Check if we have existing metrics
  const [metrics] = await db
    .select()
    .from(postStyleMetrics)
    .where(eq(postStyleMetrics.postId, postId))
    .limit(1);

  // If metrics exist, return them in PostStyleAnalysis format
  if (metrics) {
    return NextResponse.json({
      postId: metrics.postId,
      readabilityScore: metrics.readabilityScore ?? 0,
      gradeLevel: metrics.gradeLevel ?? 0,
      wordCount: metrics.wordCount ?? 0,
      sentenceCount: metrics.sentenceCount ?? 0,
      avgSentenceLength: metrics.avgSentenceLength ?? 0,
      avgSyllablesPerWord: metrics.avgSyllablesPerWord ?? 0,
      vocabDiversity: metrics.vocabDiversity ?? 0,
      passiveVoicePct: metrics.passiveVoicePct ?? 0,
      codeToProseRatio: metrics.codeToProseRatio ?? 0,
      aiPatternCount: metrics.aiPatternCount ?? 0,
      aiPatternMatches: metrics.aiPatternMatches ?? [],
      authenticityScore: metrics.authenticityScore ?? 0,
      authenticityGrade: calculateGrade(metrics.authenticityScore ?? 0),
      authenticityImprovements: ((metrics.suggestions as any)?.authenticity ?? []) as string[],
      voiceConsistencyScore: metrics.voiceConsistencyScore,
      voiceConsistencyResult: null, // Not implemented in current schema
      analyzedAt: metrics.analyzedAt ?? new Date(),
    });
  }

  // No metrics exist - analyze on-the-fly
  if (!post.markdown || post.markdown.trim().length === 0) {
    return NextResponse.json(
      { error: "Post has no markdown content to analyze" },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzePostStyle(
      postId,
      post.markdown,
      post.editDistance ?? undefined,
      post.workspaceId
    );
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[writing-coach/post/[id]] Analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze post style" },
      { status: 500 }
    );
  }
}

/**
 * Converts an authenticity score (0-100) to a letter grade (A/B/C/D/F).
 */
function calculateGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
