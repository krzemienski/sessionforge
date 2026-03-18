/**
 * Voice consistency analysis for writing coach analytics.
 * Compares a post's style signals against the author's established style
 * profile to surface deviations from their usual voice.
 */

import type { StyleMetrics } from "./authenticity-scorer";

/** The author's baseline style profile values (0–100 scales). */
export interface StyleProfile {
  /** Expected formality level (0 = very casual, 100 = very formal). */
  formality: number | null;
  /** Expected technical depth (0 = accessible, 100 = highly technical). */
  technicalDepth: number | null;
  /** Expected humour level (0 = none, 100 = heavy humour). */
  humor: number | null;
}

/** Consistency classification based on the aggregate deviation score. */
export type ConsistencyLevel =
  | "very-consistent"
  | "mostly-consistent"
  | "somewhat-inconsistent"
  | "inconsistent";

/** Result of a voice consistency comparison. */
export interface VoiceConsistencyResult {
  /**
   * Voice consistency score from 0 to 100.
   * 100 = identical to profile; lower scores indicate greater deviation.
   */
  score: number;
  /** Qualitative consistency classification. */
  consistencyLevel: ConsistencyLevel;
  /** Descriptions of specific dimensions that deviate from the profile. */
  deviations: string[];
}

/**
 * Maps a consistency score to a qualitative level label.
 *
 * @param score - Voice consistency score (0–100).
 * @returns Consistency level label.
 */
export function getConsistencyLevel(score: number): ConsistencyLevel {
  if (score >= 85) return "very-consistent";
  if (score >= 70) return "mostly-consistent";
  if (score >= 50) return "somewhat-inconsistent";
  return "inconsistent";
}

/**
 * Estimates the formality level of a document from its style metrics.
 *
 * Formality rises with higher readability (longer, structured prose) and
 * lower vocabulary diversity (measured word choices), and falls with high
 * passive voice usage which signals academic over-formality when extreme.
 * The estimate is a heuristic and should be interpreted as a relative signal.
 *
 * @param metrics - Style metrics for the post being analysed.
 * @returns Estimated formality on a 0–100 scale.
 */
function estimateFormality(metrics: StyleMetrics): number {
  // High readability → casual/accessible; low readability → formal/dense
  // Invert: formality = 100 - readabilityScore (clamped)
  const readabilityComponent = 100 - Math.max(0, Math.min(100, metrics.readabilityScore));

  // Lower vocab diversity often signals repetitive formal register
  const diversityComponent = (1 - Math.max(0, Math.min(1, metrics.vocabDiversity))) * 100;

  // Blend: 60% readability inversion + 40% diversity inversion
  return Math.round(readabilityComponent * 0.6 + diversityComponent * 0.4);
}

/**
 * Estimates the technical depth of a document from its style metrics.
 *
 * Technical depth correlates with lower readability (dense vocabulary) and
 * higher AI pattern counts (technical jargon).
 *
 * @param metrics - Style metrics for the post being analysed.
 * @returns Estimated technical depth on a 0–100 scale.
 */
function estimateTechnicalDepth(metrics: StyleMetrics): number {
  // Lower Flesch score → more technical
  const readabilityComponent = 100 - Math.max(0, Math.min(100, metrics.readabilityScore));

  // AI patterns often correlate with domain jargon/technical phrasing
  const safeWordCount = Math.max(metrics.wordCount, 1);
  const jargonDensity = Math.min(1, (metrics.aiPatternCount / safeWordCount) * 50);
  const jargonComponent = jargonDensity * 100;

  return Math.round(readabilityComponent * 0.7 + jargonComponent * 0.3);
}

/**
 * Estimates the humour level of a document from its style metrics.
 *
 * Humour is approximated by high readability (casual, accessible tone) and
 * high vocabulary diversity (playful word choices).
 *
 * @param metrics - Style metrics for the post being analysed.
 * @returns Estimated humour level on a 0–100 scale.
 */
function estimateHumor(metrics: StyleMetrics): number {
  const readabilityComponent = Math.max(0, Math.min(100, metrics.readabilityScore));
  const diversityComponent = Math.max(0, Math.min(1, metrics.vocabDiversity)) * 100;

  return Math.round(readabilityComponent * 0.5 + diversityComponent * 0.5);
}

/**
 * Compares the estimated style dimensions of a post against the author's
 * style profile and returns a consistency score with deviation notes.
 *
 * Returns `null` when no style profile is provided (the author has not yet
 * established a baseline to compare against).
 *
 * Scoring:
 * - Each profile dimension that is non-null contributes equally to the score.
 * - Per-dimension deviation is the absolute difference between the estimated
 *   value and the profile value (both on 0–100 scales).
 * - A deviation of 0 contributes 100 pts; a deviation of 50+ contributes 0 pts.
 * - Deviations ≥ 20 pts trigger a written description in `deviations`.
 *
 * @param postMetrics - Style metrics for the post being analysed.
 * @param styleProfile - Author's baseline style profile, or `null`.
 * @returns Consistency result, or `null` if no style profile is available.
 */
export function calculateVoiceConsistency(
  postMetrics: StyleMetrics,
  styleProfile: StyleProfile | null
): VoiceConsistencyResult | null {
  if (!styleProfile) return null;

  const { formality, technicalDepth, humor } = styleProfile;

  // Require at least one non-null profile dimension
  if (formality === null && technicalDepth === null && humor === null) return null;

  const dimensionScores: number[] = [];
  const deviations: string[] = [];

  const estimatedFormality = estimateFormality(postMetrics);
  const estimatedTechDepth = estimateTechnicalDepth(postMetrics);
  const estimatedHumor = estimateHumor(postMetrics);

  // ── Formality ────────────────────────────────────────────────────────────
  if (formality !== null) {
    const diff = Math.abs(estimatedFormality - formality);
    // Map diff 0→100, 50+→0
    const dimScore = Math.max(0, 100 - diff * 2);
    dimensionScores.push(dimScore);

    if (diff >= 20) {
      const direction = estimatedFormality > formality ? "more formal" : "less formal";
      deviations.push(
        `Tone appears ${direction} than your usual writing (estimated ${estimatedFormality}/100 vs. profile ${formality}/100).`
      );
    }
  }

  // ── Technical depth ───────────────────────────────────────────────────────
  if (technicalDepth !== null) {
    const diff = Math.abs(estimatedTechDepth - technicalDepth);
    const dimScore = Math.max(0, 100 - diff * 2);
    dimensionScores.push(dimScore);

    if (diff >= 20) {
      const direction = estimatedTechDepth > technicalDepth ? "more technical" : "less technical";
      deviations.push(
        `Content is ${direction} than your usual depth (estimated ${estimatedTechDepth}/100 vs. profile ${technicalDepth}/100).`
      );
    }
  }

  // ── Humour ────────────────────────────────────────────────────────────────
  if (humor !== null) {
    const diff = Math.abs(estimatedHumor - humor);
    const dimScore = Math.max(0, 100 - diff * 2);
    dimensionScores.push(dimScore);

    if (diff >= 20) {
      const direction = estimatedHumor > humor ? "more humorous" : "less humorous";
      deviations.push(
        `Writing feels ${direction} than your typical voice (estimated ${estimatedHumor}/100 vs. profile ${humor}/100).`
      );
    }
  }

  const score =
    Math.round(
      (dimensionScores.reduce((sum, s) => sum + s, 0) / dimensionScores.length) * 10
    ) / 10;

  return {
    score,
    consistencyLevel: getConsistencyLevel(score),
    deviations,
  };
}
