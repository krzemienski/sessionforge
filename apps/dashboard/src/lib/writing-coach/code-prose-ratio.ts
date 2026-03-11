/**
 * Code-to-prose ratio analysis for technical writing assessment.
 * Measures the proportion of code content versus prose in markdown documents.
 */

import { stripMarkdownForReadability } from "@/lib/seo/readability-scorer";

/** Result of a code-to-prose ratio analysis. */
export interface CodeProseRatio {
  /** Total characters found inside fenced and inline code blocks. */
  codeChars: number;
  /** Total characters of plain prose after stripping markdown syntax. */
  proseChars: number;
  /**
   * Ratio of code characters to total content characters (codeChars / (codeChars + proseChars)).
   * Returns 0 when the document contains no content at all.
   */
  ratio: number;
}

/**
 * Pattern matching fenced code blocks (``` ... ```).
 * Captures everything between the opening and closing fence, including newlines.
 */
const FENCED_CODE_BLOCK = /```[\s\S]*?```/g;

/**
 * Pattern matching inline code spans (`...`).
 * Does not match empty backtick pairs.
 */
const INLINE_CODE_SPAN = /`[^`]+`/g;

/**
 * Measures the code character count versus prose character count in a markdown
 * document, returning both raw counts and the code/total ratio.
 *
 * Code characters are extracted from:
 * - Fenced code blocks (``` ... ```)
 * - Inline code spans (`...`)
 *
 * Prose characters are derived by stripping all markdown syntax (including
 * code blocks) from the document using `stripMarkdownForReadability`, then
 * counting the remaining non-whitespace characters.
 *
 * The `ratio` is `codeChars / (codeChars + proseChars)`, clamped to [0, 1].
 * A ratio of 0 means pure prose; 1 means the document is entirely code.
 *
 * @param markdown - Raw markdown string to analyse.
 * @returns Object containing codeChars, proseChars, and ratio.
 */
export function calculateCodeToProseRatio(markdown: string): CodeProseRatio {
  if (!markdown || markdown.trim().length === 0) {
    return { codeChars: 0, proseChars: 0, ratio: 0 };
  }

  // Collect code character counts from fenced blocks
  let codeChars = 0;

  const fencedMatches = markdown.match(FENCED_CODE_BLOCK) ?? [];
  for (const block of fencedMatches) {
    // Exclude the opening/closing fence lines themselves (``` + optional lang identifier)
    const inner = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
    codeChars += inner.replace(/\s/g, "").length;
  }

  // Collect code character counts from inline spans
  const inlineMatches = markdown.match(INLINE_CODE_SPAN) ?? [];
  for (const span of inlineMatches) {
    // Exclude the surrounding backticks
    const inner = span.slice(1, -1);
    codeChars += inner.replace(/\s/g, "").length;
  }

  // Derive prose by stripping all markdown (this removes code blocks too)
  const plainProse = stripMarkdownForReadability(markdown);
  const proseChars = plainProse.replace(/\s/g, "").length;

  const total = codeChars + proseChars;
  const ratio = total > 0 ? Math.round((codeChars / total) * 1000) / 1000 : 0;

  return { codeChars, proseChars, ratio };
}
