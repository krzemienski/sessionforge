/**
 * Vocabulary diversity analysis for writing quality assessment.
 * Uses the type-token ratio (TTR) to measure lexical variety in prose.
 */

import { splitIntoWords } from "@/lib/seo/readability-scorer";

/**
 * Calculates the vocabulary diversity of the given text using the
 * type-token ratio (TTR): unique word count ÷ total word count.
 *
 * A score of 1.0 means every word is unique; 0.0 means a single word
 * repeated throughout. Typical human prose scores between 0.4 and 0.7.
 * Scores below 0.3 often indicate repetitive, low-variety writing.
 *
 * Words are compared case-insensitively so "The" and "the" count as
 * one type.
 *
 * @param text - Plain text or markdown to analyse.
 * @returns Type-token ratio in the range [0, 1], or 0 for empty input.
 */
export function calculateVocabDiversity(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  const words = splitIntoWords(text);
  const totalTokens = words.length;

  if (totalTokens === 0) return 0;

  const uniqueTypes = new Set(words.map((w) => w.toLowerCase()));
  const uniqueTokens = uniqueTypes.size;

  return uniqueTokens / totalTokens;
}
