/**
 * Style analyzer orchestrator for writing coach analytics.
 * Coordinates all writing analysis functions and persists results to the database.
 */

import { db } from "@/lib/db";
import { posts, postStyleMetrics } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { scoreReadability } from "@/lib/seo/readability-scorer";
import { stripMarkdownForReadability, splitIntoSentences } from "@/lib/seo/readability-scorer";
import { detectAiPatterns, type AiPatternMatch } from "./ai-pattern-detector";
import { calculateVocabDiversity } from "./vocab-diversity";
import { calculateCodeToProseRatio } from "./code-prose-ratio";
import { calculateAuthenticityScore, type StyleMetrics, type AuthenticityResult } from "./authenticity-scorer";
import type { VoiceConsistencyResult } from "./voice-consistency";

/** Complete result of a post style analysis. */
export interface PostStyleAnalysis {
  /** The post ID that was analyzed. */
  postId: string;
  /** Flesch Reading Ease score (0–100). */
  readabilityScore: number;
  /** Flesch-Kincaid grade level. */
  gradeLevel: number;
  /** Total word count. */
  wordCount: number;
  /** Total sentence count. */
  sentenceCount: number;
  /** Average words per sentence. */
  avgSentenceLength: number;
  /** Average syllables per word. */
  avgSyllablesPerWord: number;
  /** Type-token ratio (0–1). */
  vocabDiversity: number;
  /** Passive voice percentage (0–100). */
  passiveVoicePct: number;
  /** Code-to-prose ratio (0–1). */
  codeToProseRatio: number;
  /** Number of AI-tell phrases detected. */
  aiPatternCount: number;
  /** Detailed AI pattern matches with positions. */
  aiPatternMatches: AiPatternMatch[];
  /** Authenticity score (0–100). */
  authenticityScore: number;
  /** Authenticity grade (A/B/C/D/F). */
  authenticityGrade: string;
  /** Authenticity improvement suggestions. */
  authenticityImprovements: string[];
  /** Voice consistency score (0–100), or null if no style profile. */
  voiceConsistencyScore: number | null;
  /** Voice consistency result details, or null if no style profile. */
  voiceConsistencyResult: VoiceConsistencyResult | null;
  /** When this analysis was performed. */
  analyzedAt: Date;
}

/**
 * Passive voice indicator pattern (same as readability-scorer.ts internal).
 * Exported here for use in passive voice calculation.
 */
const PASSIVE_VOICE_PATTERN = /\b(am|is|are|was|were|be|been|being)\s+\w+ed\b/gi;

/**
 * Counts the number of passive voice instances in plain text.
 *
 * @param text - Plain text to scan.
 * @returns Number of passive voice instances found.
 */
function countPassiveVoice(text: string): number {
  const matches = text.match(PASSIVE_VOICE_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Analyzes the writing style of a single post and persists the results to the
 * postStyleMetrics table.
 *
 * Workflow:
 * 1. Runs readability analysis (Flesch-Kincaid)
 * 2. Detects AI-tell patterns
 * 3. Computes vocabulary diversity (type-token ratio)
 * 4. Calculates code-to-prose ratio
 * 5. Computes authenticity score
 * 6. Optionally computes voice consistency against style profile
 * 7. Upserts all results to postStyleMetrics table
 *
 * @param postId - The ID of the post to analyze.
 * @param markdown - The markdown content of the post.
 * @param editDistance - Optional edit distance for authenticity bonus calculation.
 * @param workspaceId - Optional workspace ID (required for DB upsert).
 * @returns Complete style analysis result with all metrics.
 * @throws {Error} If database operations fail.
 */
export async function analyzePostStyle(
  postId: string,
  markdown: string,
  editDistance?: number,
  workspaceId?: string
): Promise<PostStyleAnalysis> {
  // ── 1. Readability analysis ──────────────────────────────────────────────
  const readability = scoreReadability(markdown);

  // ── 2. AI pattern detection ──────────────────────────────────────────────
  const plainText = stripMarkdownForReadability(markdown);
  const aiPatterns = detectAiPatterns(plainText);

  // ── 3. Vocabulary diversity ──────────────────────────────────────────────
  const vocabDiversity = calculateVocabDiversity(plainText);

  // ── 4. Code-to-prose ratio ───────────────────────────────────────────────
  const codeProseRatio = calculateCodeToProseRatio(markdown);

  // ── 5. Passive voice percentage ──────────────────────────────────────────
  const sentences = splitIntoSentences(plainText);
  const passiveCount = countPassiveVoice(plainText);
  const passiveVoicePct = sentences.length > 0
    ? Math.round((passiveCount / sentences.length) * 100 * 10) / 10
    : 0;

  // ── 6. Authenticity score ────────────────────────────────────────────────
  const styleMetrics: StyleMetrics = {
    readabilityScore: readability.score,
    vocabDiversity,
    passiveVoicePct,
    aiPatternCount: aiPatterns.length,
    wordCount: readability.wordCount,
    editDistanceRatio: editDistance && readability.wordCount > 0
      ? editDistance / readability.wordCount
      : 0,
  };

  const authenticityResult = calculateAuthenticityScore(styleMetrics);

  // ── 7. Voice consistency (optional) ──────────────────────────────────────
  // Note: Voice consistency requires a style profile with formality, technicalDepth,
  // and humor fields. The current writingStyleProfiles schema uses toneAttributes
  // instead, so we skip this analysis for now.
  const voiceConsistencyResult: VoiceConsistencyResult | null = null;

  // ── 8. Upsert to database ────────────────────────────────────────────────
  if (workspaceId) {
    // Check if a record already exists
    const [existing] = await db
      .select()
      .from(postStyleMetrics)
      .where(eq(postStyleMetrics.postId, postId))
      .limit(1);

    const metricsData = {
      postId,
      workspaceId,
      readabilityScore: readability.score,
      gradeLevel: readability.gradeLevel,
      wordCount: readability.wordCount,
      sentenceCount: readability.sentenceCount,
      avgSentenceLength: readability.averageSentenceLength,
      avgSyllablesPerWord: readability.averageSyllablesPerWord,
      vocabDiversity,
      passiveVoicePct,
      codeToProseRatio: codeProseRatio.ratio,
      aiPatternCount: aiPatterns.length,
      aiPatternMatches: aiPatterns,
      authenticityScore: authenticityResult.score,
      voiceConsistencyScore: null,
      suggestions: {
        readability: readability.suggestions,
        authenticity: authenticityResult.improvements,
        voiceConsistency: [],
      },
      analyzedAt: new Date(),
    };

    if (existing) {
      // Update existing record
      await db
        .update(postStyleMetrics)
        .set(metricsData)
        .where(eq(postStyleMetrics.id, existing.id));
    } else {
      // Insert new record
      await db
        .insert(postStyleMetrics)
        .values(metricsData);
    }
  }

  // ── 9. Return analysis result ────────────────────────────────────────────
  return {
    postId,
    readabilityScore: readability.score,
    gradeLevel: readability.gradeLevel,
    wordCount: readability.wordCount,
    sentenceCount: readability.sentenceCount,
    avgSentenceLength: readability.averageSentenceLength,
    avgSyllablesPerWord: readability.averageSyllablesPerWord,
    vocabDiversity,
    passiveVoicePct,
    codeToProseRatio: codeProseRatio.ratio,
    aiPatternCount: aiPatterns.length,
    aiPatternMatches: aiPatterns,
    authenticityScore: authenticityResult.score,
    authenticityGrade: authenticityResult.grade,
    authenticityImprovements: authenticityResult.improvements,
    voiceConsistencyScore: null,
    voiceConsistencyResult: null,
    analyzedAt: new Date(),
  };
}

/**
 * Batch-analyzes all posts in a workspace that have markdown content.
 *
 * Fetches all posts in the specified workspace, filters for those with markdown,
 * and runs `analyzePostStyle` on each. Processes sequentially to avoid overwhelming
 * the database with concurrent writes.
 *
 * Intended for use in fire-and-forget background jobs (e.g., triggered by
 * the "Analyze All Posts" button in the writing coach dashboard).
 *
 * @param workspaceId - The workspace ID to batch-analyze.
 * @returns Promise that resolves when all posts have been analyzed.
 * @throws {Error} If database operations fail.
 */
export async function analyzeWorkspacePosts(workspaceId: string): Promise<void> {
  // Fetch all posts in the workspace with markdown content
  const workspacePosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        // Only analyze posts that have markdown (content-based posts)
      )
    );

  // Filter to posts with non-empty markdown
  const postsToAnalyze = workspacePosts.filter((p) => p.markdown && p.markdown.trim().length > 0);

  // Analyze each post sequentially
  for (const post of postsToAnalyze) {
    try {
      await analyzePostStyle(
        post.id,
        post.markdown!,
        post.editDistance ?? undefined,
        workspaceId
      );
    } catch (error) {
      // Log error but continue processing remaining posts
      console.error(`[style-analyzer] Failed to analyze post ${post.id}:`, error);
    }
  }
}
