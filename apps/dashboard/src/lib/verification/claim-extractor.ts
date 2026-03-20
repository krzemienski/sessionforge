/**
 * ClaimExtractor — parser for extracting verifiable factual claims from markdown.
 *
 * Parses markdown content into individual sentences, then identifies factual
 * assertions (version numbers, performance metrics, API behaviors, comparisons,
 * dates, statistics) vs opinion/narrative. Uses regex patterns and heuristics
 * to flag claims that are likely verifiable.
 *
 * Follow the pattern from CitationExtractor in lib/citations/extractor.ts.
 */

import type { ClaimExtractionResult } from "./types";

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Regex pattern for detecting code blocks and inline code.
 * Matches:
 *   - Fenced code blocks: ```...```
 *   - Inline code: `...`
 */
const CODE_PATTERN = /(```[\s\S]*?```|`[^`]+?`)/g;

/**
 * Regex pattern for splitting markdown into sentences.
 * Splits on sentence-ending punctuation followed by whitespace or end-of-string,
 * while avoiding false splits on abbreviations, decimals, and URLs.
 */
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z])/g;

// ── Claim detection patterns ───────────────────────────────────────────────

/** Matches version numbers like v2.0, 3.14.1, version 4.x */
const VERSION_PATTERN =
  /\b(?:v(?:ersion)?\s*)?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)\b/i;

/** Matches performance metrics: 50ms, 2x faster, 99.9% uptime, 10GB */
const PERFORMANCE_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:ms|seconds?|s|minutes?|min|hours?|hr|%|x\s+(?:faster|slower|more|less|improvement)|(?:MB|GB|TB|KB)(?:\/s)?|ops?\/s(?:ec)?|req\/s|rps|qps|tps)\b/i;

/** Matches API behavior claims: returns, throws, accepts, requires, supports */
const API_BEHAVIOR_PATTERN =
  /\b(?:returns?|throws?|accepts?|requires?|supports?|implements?|provides?|exposes?|emits?|handles?|rejects?|resolves?|dispatches?)\s+(?:a|an|the)?\s*\w/i;

/** Matches comparison claims: faster than, better than, more X than, unlike */
const COMPARISON_PATTERN =
  /\b(?:faster|slower|better|worse|more|less|larger|smaller|higher|lower|fewer)\s+(?:than)\b|\b(?:unlike|compared\s+to|versus|vs\.?)\b/i;

/** Matches date references: in 2024, since March, as of Q3, last year */
const DATE_PATTERN =
  /\b(?:in|since|as\s+of|before|after|during|until)\s+(?:20\d{2}|Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December)\b|\b(?:last|next|this)\s+(?:year|month|week|quarter)\b/i;

/** Matches statistics: 50%, 1.2 million, doubled, tripled */
const STATISTIC_PATTERN =
  /\b\d+(?:\.\d+)?(?:\s*(?:%|percent|million|billion|thousand))\b|\b(?:doubled|tripled|halved|quadrupled)\b/i;

/** Matches opinion/subjective language that disqualifies claims */
const OPINION_PATTERN =
  /\b(?:I\s+(?:think|believe|feel|prefer)|in\s+my\s+(?:opinion|experience|view)|arguably|probably|maybe|perhaps|seems?\s+(?:like|to)|might\s+be|could\s+be|personally|subjectively)\b/i;

/** Matches hedging language that reduces confidence */
const HEDGE_PATTERN =
  /\b(?:generally|typically|usually|often|sometimes|may|might|could|can|tends?\s+to|approximately|roughly|about|around|likely|possibly)\b/i;

/** Matches markdown headings */
const HEADING_PATTERN = /^#{1,6}\s+/;

/** Matches markdown list items */
const LIST_ITEM_PATTERN = /^[\s]*[-*+]\s+|^[\s]*\d+\.\s+/;

// ── ClaimExtractor ─────────────────────────────────────────────────────────

export class ClaimExtractor {
  /**
   * Extract all verifiable factual claims from markdown content.
   *
   * Parses markdown into sentences, classifies each as a factual claim or
   * opinion/narrative, and returns extraction results for sentences that
   * contain verifiable assertions.
   *
   * @param markdown - The markdown content to analyze
   * @returns Array of extracted claims with their type and position
   *
   * @example
   * ```ts
   * const extractor = new ClaimExtractor();
   * const markdown = "React 18.2 introduced concurrent rendering. I think it's great.";
   * const claims = extractor.extract(markdown);
   * // => [{
   * //   sentence: "React 18.2 introduced concurrent rendering.",
   * //   startOffset: 0,
   * //   endOffset: 46,
   * //   claimType: "version_number",
   * //   confidence: 0.9,
   * // }]
   * ```
   */
  extract(markdown: string): ClaimExtractionResult[] {
    // Get positions of all code regions to exclude
    const codeRegions = this.findCodeRegions(markdown);

    // Split markdown into sentences with their positions
    const sentences = this.splitIntoSentences(markdown);

    const results: ClaimExtractionResult[] = [];

    for (const { text, startOffset, endOffset } of sentences) {
      // Skip if the sentence is entirely within a code region
      if (this.isInCodeRegion(startOffset, codeRegions)) {
        continue;
      }

      // Skip very short sentences (unlikely to contain meaningful claims)
      if (text.trim().length < 10) {
        continue;
      }

      // Skip sentences that are purely opinion/subjective
      if (OPINION_PATTERN.test(text)) {
        continue;
      }

      // Classify the sentence
      const classification = this.classifySentence(text);

      if (classification) {
        results.push({
          sentence: text.trim(),
          startOffset,
          endOffset,
          claimType: classification.claimType,
          confidence: classification.confidence,
        });
      }
    }

    return results;
  }

  /**
   * Extract claims with a minimum confidence threshold.
   *
   * Filters extraction results to only include claims at or above the
   * specified confidence level.
   *
   * @param markdown - The markdown content to analyze
   * @param minConfidence - Minimum confidence threshold (0-1, default: 0.5)
   * @returns Array of claims meeting the confidence threshold
   *
   * @example
   * ```ts
   * const extractor = new ClaimExtractor();
   * const claims = extractor.extractHighConfidence(markdown, 0.8);
   * ```
   */
  extractHighConfidence(
    markdown: string,
    minConfidence = 0.5
  ): ClaimExtractionResult[] {
    return this.extract(markdown).filter(
      (claim) => claim.confidence >= minConfidence
    );
  }

  /**
   * Count the number of verifiable claims in markdown content.
   *
   * @param markdown - The markdown content to analyze
   * @returns Number of verifiable claims detected
   *
   * @example
   * ```ts
   * const extractor = new ClaimExtractor();
   * const count = extractor.getClaimCount("Node v20.0 added fetch natively.");
   * // => 1
   * ```
   */
  getClaimCount(markdown: string): number {
    return this.extract(markdown).length;
  }

  /**
   * Check if markdown content contains any verifiable claims.
   *
   * @param markdown - The markdown content to check
   * @returns True if at least one verifiable claim is detected
   *
   * @example
   * ```ts
   * const extractor = new ClaimExtractor();
   * extractor.hasClaims("This is an opinion piece."); // => false
   * extractor.hasClaims("Node v20 added native fetch."); // => true
   * ```
   */
  hasClaims(markdown: string): boolean {
    return this.getClaimCount(markdown) > 0;
  }

  /**
   * Get a breakdown of claim types found in the content.
   *
   * @param markdown - The markdown content to analyze
   * @returns Map of claim type to count
   *
   * @example
   * ```ts
   * const extractor = new ClaimExtractor();
   * const breakdown = extractor.getClaimBreakdown(markdown);
   * // => { version_number: 3, performance_metric: 1 }
   * ```
   */
  getClaimBreakdown(
    markdown: string
  ): Record<ClaimExtractionResult["claimType"], number> {
    const claims = this.extract(markdown);
    const breakdown: Record<string, number> = {};

    for (const claim of claims) {
      breakdown[claim.claimType] = (breakdown[claim.claimType] ?? 0) + 1;
    }

    return breakdown as Record<ClaimExtractionResult["claimType"], number>;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Split markdown into sentences with their character positions.
   *
   * Handles markdown-specific constructs like headings, list items, and
   * paragraphs. Preserves position information for each sentence.
   */
  private splitIntoSentences(
    markdown: string
  ): Array<{ text: string; startOffset: number; endOffset: number }> {
    const sentences: Array<{
      text: string;
      startOffset: number;
      endOffset: number;
    }> = [];

    // First split by paragraphs/line breaks to handle block-level elements
    const lines = markdown.split(/\n/);
    let offset = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines, code fences, and horizontal rules
      if (!trimmed || trimmed.startsWith("```") || /^[-*_]{3,}$/.test(trimmed)) {
        offset += line.length + 1; // +1 for the newline
        continue;
      }

      // Clean markdown formatting for sentence analysis
      let cleanLine = trimmed;
      cleanLine = cleanLine.replace(HEADING_PATTERN, "");
      cleanLine = cleanLine.replace(LIST_ITEM_PATTERN, "");

      // Split the line into sentences
      const lineSentences = cleanLine.split(SENTENCE_SPLIT);
      let lineOffset = offset + (line.length - line.trimStart().length);

      // Adjust for heading/list prefix removal
      const headingMatch = trimmed.match(HEADING_PATTERN);
      const listMatch = trimmed.match(LIST_ITEM_PATTERN);
      if (headingMatch) {
        lineOffset += headingMatch[0].length;
      } else if (listMatch) {
        lineOffset += listMatch[0].length;
      }

      for (const sentence of lineSentences) {
        if (sentence.trim().length > 0) {
          const startOffset = lineOffset;
          const endOffset = lineOffset + sentence.length;

          sentences.push({
            text: sentence.trim(),
            startOffset,
            endOffset,
          });

          // Move past sentence + any whitespace that was consumed by the split
          lineOffset = endOffset + 1;
        }
      }

      offset += line.length + 1; // +1 for the newline
    }

    return sentences;
  }

  /**
   * Classify a sentence into a claim type with confidence.
   *
   * Tests the sentence against known factual-claim patterns and returns
   * the best matching type. Returns null for non-factual sentences.
   */
  private classifySentence(
    sentence: string
  ): { claimType: ClaimExtractionResult["claimType"]; confidence: number } | null {
    // Test each pattern in priority order (most specific first)
    const patterns: Array<{
      pattern: RegExp;
      type: ClaimExtractionResult["claimType"];
      baseConfidence: number;
    }> = [
      { pattern: VERSION_PATTERN, type: "version_number", baseConfidence: 0.9 },
      {
        pattern: PERFORMANCE_PATTERN,
        type: "performance_metric",
        baseConfidence: 0.85,
      },
      { pattern: STATISTIC_PATTERN, type: "statistic", baseConfidence: 0.85 },
      { pattern: COMPARISON_PATTERN, type: "comparison", baseConfidence: 0.7 },
      { pattern: DATE_PATTERN, type: "date_reference", baseConfidence: 0.75 },
      {
        pattern: API_BEHAVIOR_PATTERN,
        type: "api_behavior",
        baseConfidence: 0.65,
      },
    ];

    for (const { pattern, type, baseConfidence } of patterns) {
      if (pattern.test(sentence)) {
        const confidence = this.adjustConfidence(sentence, baseConfidence);
        return { claimType: type, confidence };
      }
    }

    return null;
  }

  /**
   * Adjust confidence based on hedging language and sentence characteristics.
   *
   * Reduces confidence when hedging words are present, and increases it
   * when the sentence contains multiple factual indicators.
   */
  private adjustConfidence(sentence: string, baseConfidence: number): number {
    let confidence = baseConfidence;

    // Reduce confidence if hedging language is present
    if (HEDGE_PATTERN.test(sentence)) {
      confidence *= 0.7;
    }

    // Increase confidence slightly for longer, more specific sentences
    if (sentence.length > 80) {
      confidence = Math.min(1, confidence + 0.05);
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Find all code regions (code blocks and inline code) in markdown.
   *
   * Returns an array of [start, end] positions for each code region.
   * Claims within these regions should be ignored.
   */
  private findCodeRegions(markdown: string): Array<[number, number]> {
    const regions: Array<[number, number]> = [];
    const pattern = new RegExp(CODE_PATTERN);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(markdown)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      regions.push([start, end]);
    }

    return regions;
  }

  /**
   * Check if a given position falls within any code region.
   */
  private isInCodeRegion(
    position: number,
    codeRegions: Array<[number, number]>
  ): boolean {
    return codeRegions.some(
      ([start, end]) => position >= start && position < end
    );
  }
}
