/**
 * Authenticity scoring service for writing coach analytics.
 * Combines multiple style signals into a single authenticity grade that
 * reflects how human and original a piece of writing appears.
 */

/** Input metrics required to compute an authenticity score. */
export interface StyleMetrics {
  /** Flesch Reading Ease score (0–100). Higher = easier to read. */
  readabilityScore: number;
  /** Type-token ratio (0–1). Higher = more diverse vocabulary. */
  vocabDiversity: number;
  /** Passive voice percentage of total sentences (0–100). */
  passiveVoicePct: number;
  /** Total number of AI-tell phrases detected in the text. */
  aiPatternCount: number;
  /** Total word count of the document. */
  wordCount: number;
  /**
   * Edit distance ratio: total edit distance between draft and final divided
   * by word count. Higher = more manual revision effort invested.
   */
  editDistanceRatio: number;
}

/** Letter grade derived from the authenticity score. */
export type AuthenticityGrade = "A" | "B" | "C" | "D" | "F";

/** Result of an authenticity analysis. */
export interface AuthenticityResult {
  /**
   * Authenticity score from 0 to 100.
   * 90–100 = A, 80–89 = B, 70–79 = C, 60–69 = D, <60 = F.
   */
  score: number;
  /** Letter grade corresponding to the score. */
  grade: AuthenticityGrade;
  /** Prioritised list of actionable improvement suggestions. */
  improvements: string[];
}

/**
 * Normalises a value to the range [0, 1] within the given bounds.
 *
 * @param value - The raw value to normalise.
 * @param min - The lower bound of the input range.
 * @param max - The upper bound of the input range.
 * @returns Clamped normalised value in [0, 1].
 */
function normalise(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Derives the letter grade for a given authenticity score.
 *
 * @param score - Authenticity score (0–100).
 * @returns Corresponding letter grade.
 */
export function getAuthenticityGrade(score: number): AuthenticityGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Calculates an authenticity score (0–100) and letter grade for a piece of
 * writing based on several style signals.
 *
 * Scoring model:
 * - Start at 100 points.
 * - AI pattern density penalty: up to −35 pts (scales from 0 at 0 patterns
 *   per 100 words to −35 at ≥5 patterns per 100 words).
 * - Vocabulary diversity penalty: up to −20 pts when TTR < 0.4 (no penalty
 *   at TTR ≥ 0.4).
 * - Passive voice penalty: up to −15 pts when passive voice % > 20 (no
 *   penalty at or below 20%).
 * - Readability penalty: up to −15 pts when Flesch score < 50 (no penalty
 *   at score ≥ 50).
 * - Edit distance bonus: up to +10 pts when editDistanceRatio ≥ 0.1 (no
 *   bonus below that threshold).
 *
 * The final score is clamped to [0, 100] and rounded to one decimal place.
 *
 * @param metrics - Style metrics gathered from the document.
 * @returns Authenticity result with score, grade, and improvement suggestions.
 */
export function calculateAuthenticityScore(metrics: StyleMetrics): AuthenticityResult {
  const {
    readabilityScore,
    vocabDiversity,
    passiveVoicePct,
    aiPatternCount,
    wordCount,
    editDistanceRatio,
  } = metrics;

  let score = 100;
  const improvements: string[] = [];

  // ── AI pattern density penalty (up to −35 pts) ────────────────────────
  // Density = patterns per 100 words. Max penalty at ≥ 5 per 100 words.
  const safeWordCount = Math.max(wordCount, 1);
  const aiDensity = (aiPatternCount / safeWordCount) * 100;
  const aiPenalty = normalise(aiDensity, 0, 5) * 35;
  score -= aiPenalty;

  if (aiDensity >= 2) {
    improvements.push(
      `${aiPatternCount} AI-tell phrase${aiPatternCount !== 1 ? "s" : ""} detected. Review highlighted phrases and replace with your own voice.`
    );
  } else if (aiPatternCount > 0) {
    improvements.push(
      `${aiPatternCount} AI-tell phrase${aiPatternCount !== 1 ? "s" : ""} found. Consider rephrasing to strengthen authenticity.`
    );
  }

  // ── Vocabulary diversity penalty (up to −20 pts) ─────────────────────
  // No penalty at TTR ≥ 0.4; full penalty at TTR = 0.
  if (vocabDiversity < 0.4) {
    const vocabPenalty = normalise(0.4 - vocabDiversity, 0, 0.4) * 20;
    score -= vocabPenalty;
    improvements.push(
      `Vocabulary diversity is low (${Math.round(vocabDiversity * 100)}%). Vary your word choices to avoid repetitive phrasing.`
    );
  }

  // ── Passive voice penalty (up to −15 pts) ─────────────────────────────
  // No penalty at ≤ 20%; full penalty at ≥ 60%.
  if (passiveVoicePct > 20) {
    const passivePenalty = normalise(passiveVoicePct - 20, 0, 40) * 15;
    score -= passivePenalty;
    improvements.push(
      `Passive voice used in ${Math.round(passiveVoicePct)}% of sentences. Aim for under 20% to keep writing direct and engaging.`
    );
  }

  // ── Readability penalty (up to −15 pts) ──────────────────────────────
  // No penalty at Flesch ≥ 50; full penalty at Flesch = 0.
  if (readabilityScore < 50) {
    const readabilityPenalty = normalise(50 - readabilityScore, 0, 50) * 15;
    score -= readabilityPenalty;
    improvements.push(
      `Readability score is ${readabilityScore} (target ≥ 50). Shorten sentences and replace complex words with simpler alternatives.`
    );
  }

  // ── Edit distance bonus (up to +10 pts) ─────────────────────────────
  // No bonus below 0.1; full bonus at editDistanceRatio ≥ 0.5.
  if (editDistanceRatio >= 0.1) {
    const editBonus = normalise(editDistanceRatio - 0.1, 0, 0.4) * 10;
    score += editBonus;
  }

  const finalScore = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;

  return {
    score: finalScore,
    grade: getAuthenticityGrade(finalScore),
    improvements,
  };
}
