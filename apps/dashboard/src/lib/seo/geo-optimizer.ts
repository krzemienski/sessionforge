/**
 * GEO (Generative Engine Optimization) analyzer.
 *
 * Checks content against four criteria that AI-powered search engines
 * (Perplexity, ChatGPT Search, Google AI Overviews) use when selecting
 * content to cite:
 *
 * 1. Clear heading structure — logical H1–H6 hierarchy.
 * 2. Factual density — statistics and numbers per 100 words.
 * 3. Citation formatting — external links and references present.
 * 4. Scannable sections — lists and short paragraphs aid AI parsing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Identifier for each GEO optimization check. */
export type GeoCheckId =
  | "heading-structure"
  | "factual-density"
  | "citation-formatting"
  | "scannable-sections";

/** Result for a single GEO optimization check. */
export interface GeoCheckResult {
  /** Unique identifier for the check. */
  id: GeoCheckId;
  /** Human-readable name of the check. */
  name: string;
  /** Explanation of what the check evaluates. */
  description: string;
  /** Whether the check passed its threshold. */
  passed: boolean;
  /**
   * Score from 0 to 100 for this individual check.
   * Reflects how well the content meets the criterion.
   */
  score: number;
  /** Actionable suggestions to improve this criterion. */
  suggestions: string[];
}

/** Aggregate GEO analysis result for a piece of content. */
export interface GeoAnalysisResult {
  /**
   * Composite GEO score from 0 to 100.
   * Calculated as the average of all individual check scores.
   */
  score: number;
  /** Number of individual checks that passed. */
  passed: number;
  /** Total number of checks performed. */
  total: number;
  /** Detailed results for each GEO criterion. */
  checks: GeoCheckResult[];
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

/**
 * Extracts heading lines from markdown, returning each heading as an object
 * with its level (1–6) and text.
 *
 * @param markdown - Raw markdown string.
 * @returns Array of headings with their level and text.
 */
export function extractHeadings(markdown: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }

  return headings;
}

/**
 * Strips markdown syntax to produce plain text for word-count and
 * fact-density analysis.
 *
 * @param markdown - Raw markdown string.
 * @returns Plain text with syntax removed.
 */
export function stripMarkdownForGeo(markdown: string): string {
  return markdown
    // Remove fenced code blocks (don't count code tokens as prose)
    .replace(/```[\s\S]*?```/g, " ")
    // Remove inline code
    .replace(/`[^`]*`/g, " ")
    // Remove HTML tags
    .replace(/<[^>]+>/g, " ")
    // Remove markdown images
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    // Remove markdown links — keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown headings
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic markers
    .replace(/\*{1,3}|_{1,3}/g, "")
    // Remove blockquotes
    .replace(/^>\s*/gm, "")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, " ")
    // Remove numbered list markers
    .replace(/^\d+\.\s+/gm, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Counts words in a plain-text string.
 *
 * @param text - Plain text.
 * @returns Word count.
 */
function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).length;
}

// ---------------------------------------------------------------------------
// Check 1: Heading Structure
// ---------------------------------------------------------------------------

/** Minimum number of headings required to pass the structure check. */
const HEADING_MIN_COUNT = 2;

/**
 * Evaluates whether the content has a clear, logical heading hierarchy.
 *
 * Scoring:
 * - 0 headings → score 0, fail.
 * - 1 heading → score 30, fail.
 * - 2–3 headings → score 70, pass (basic structure).
 * - 4+ headings with multiple levels → score 90–100, pass.
 * Deductions apply for skipped heading levels (e.g. H1 → H3 without H2).
 *
 * @param markdown - Raw markdown content.
 * @returns GeoCheckResult for the heading-structure criterion.
 */
function checkHeadingStructure(markdown: string): GeoCheckResult {
  const headings = extractHeadings(markdown);
  const suggestions: string[] = [];

  if (headings.length === 0) {
    return {
      id: "heading-structure",
      name: "Clear Heading Structure",
      description: "Content uses H1–H6 headings to create a logical hierarchy for AI parsing.",
      passed: false,
      score: 0,
      suggestions: [
        "Add headings (## H2, ### H3) to organise content into clearly labelled sections.",
        "AI search engines use heading structure to understand content hierarchy and create citations.",
      ],
    };
  }

  if (headings.length === 1) {
    suggestions.push(
      `Only one heading found. Add at least ${HEADING_MIN_COUNT} headings to create scannable sections.`
    );
  }

  // Check for skipped heading levels (e.g. H1 → H3)
  let skippedLevels = 0;
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) {
      skippedLevels++;
    }
  }

  if (skippedLevels > 0) {
    suggestions.push(
      `${skippedLevels} skipped heading level${skippedLevels > 1 ? "s" : ""} detected (e.g. H1 → H3). ` +
        "Use sequential heading levels for better AI comprehension."
    );
  }

  // Count distinct heading levels used
  const levels = new Set(headings.map((h) => h.level));
  const levelCount = levels.size;

  // Score calculation
  let score: number;
  if (headings.length >= 4 && levelCount >= 2) {
    score = skippedLevels === 0 ? 100 : 80;
  } else if (headings.length >= 2) {
    score = skippedLevels === 0 ? 75 : 60;
  } else {
    score = 30;
  }

  if (score < 70) {
    suggestions.push("Aim for at least 4 headings with 2 or more heading levels (H2 + H3) for optimal AI parsing.");
  }

  return {
    id: "heading-structure",
    name: "Clear Heading Structure",
    description: "Content uses H1–H6 headings to create a logical hierarchy for AI parsing.",
    passed: headings.length >= HEADING_MIN_COUNT,
    score,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// Check 2: Factual Density
// ---------------------------------------------------------------------------

/** Number of facts per 100 words required to pass. */
const FACTUAL_DENSITY_THRESHOLD = 1.5;

/**
 * Counts numeric facts in the plain text.
 * Matches: standalone integers/decimals, percentages, currency values,
 * multipliers (2x, 3x), and year-like four-digit numbers.
 *
 * @param plainText - Stripped plain text.
 * @returns Number of numeric fact occurrences.
 */
export function countNumericFacts(plainText: string): number {
  const patterns = [
    // Percentages: 42%, 3.5%
    /\b\d+(?:\.\d+)?%/g,
    // Currency: $42, $1,234, £99, €50
    /[$£€¥]\s*\d[\d,.]*/g,
    // Multipliers: 2x, 10x
    /\b\d+x\b/gi,
    // Numbers with units: 100ms, 50KB, 3GB, 10px, 5s, 2h
    /\b\d+(?:\.\d+)?\s*(?:ms|kb|mb|gb|tb|px|em|rem|vh|vw|s|m|h|km|mi|kg|lb)\b/gi,
    // Standalone integers >= 2 digits (likely significant figures, not word articles like "1")
    /\b(?:100|[2-9]\d|\d{3,})\b/g,
  ];

  const seen = new Set<string>();
  let count = 0;

  for (const pattern of patterns) {
    const matches = plainText.match(pattern) ?? [];
    for (const match of matches) {
      // Deduplicate by match + approximate position via string index
      if (!seen.has(match)) {
        seen.add(match);
        count++;
      }
    }
  }

  return count;
}

/**
 * Evaluates factual density — the number of statistics and numeric
 * references per 100 words.
 *
 * AI search engines prefer content with concrete data points that can be
 * cited. A density of 1.5+ facts per 100 words is considered sufficient.
 *
 * @param markdown - Raw markdown content.
 * @returns GeoCheckResult for the factual-density criterion.
 */
function checkFactualDensity(markdown: string): GeoCheckResult {
  const plainText = stripMarkdownForGeo(markdown);
  const wordCount = countWords(plainText);
  const factCount = countNumericFacts(plainText);
  const suggestions: string[] = [];

  if (wordCount === 0) {
    return {
      id: "factual-density",
      name: "Factual Density",
      description: "Content includes statistics and numeric data that AI engines can cite.",
      passed: false,
      score: 0,
      suggestions: ["Add numeric data, statistics, and specific figures to your content."],
    };
  }

  const factsPerHundred = (factCount / wordCount) * 100;

  // Score proportionally up to 100 at 3× the threshold
  const scoreRaw = Math.min((factsPerHundred / (FACTUAL_DENSITY_THRESHOLD * 3)) * 100, 100);
  const score = Math.round(scoreRaw);

  if (factsPerHundred < FACTUAL_DENSITY_THRESHOLD) {
    suggestions.push(
      `Factual density is ${factsPerHundred.toFixed(1)} facts per 100 words ` +
        `(target: ${FACTUAL_DENSITY_THRESHOLD}+). ` +
        "Include specific statistics, percentages, or measurements."
    );
    suggestions.push(
      "AI engines like Perplexity prioritise citable facts. Add data from research, " +
        "benchmarks, or studies to increase citation likelihood."
    );
  }

  return {
    id: "factual-density",
    name: "Factual Density",
    description: "Content includes statistics and numeric data that AI engines can cite.",
    passed: factsPerHundred >= FACTUAL_DENSITY_THRESHOLD,
    score,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// Check 3: Citation Formatting
// ---------------------------------------------------------------------------

/** Minimum number of citations/links required to pass. */
const CITATION_MIN_COUNT = 2;

/**
 * Counts external link references in the markdown.
 * Matches: inline links `[text](url)`, bare URLs, and reference-style
 * citations such as `[1]`, `[2]` etc.
 *
 * @param markdown - Raw markdown content.
 * @returns Number of citation references found.
 */
export function countCitations(markdown: string): number {
  let count = 0;

  // Inline markdown links: [text](url) — count external links only
  const inlineLinks = markdown.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g) ?? [];
  count += inlineLinks.length;

  // Reference-style footnotes: [^1], [^note]
  const footnoteRefs = markdown.match(/\[\^[^\]]+\]/g) ?? [];
  count += footnoteRefs.length;

  // Numeric reference citations: [1], [2], [12]
  const numericCitations = markdown.match(/\[\d+\]/g) ?? [];
  count += numericCitations.length;

  // Source attribution phrases (each unique phrase counts as one)
  const attributionPhrases = [
    /according\s+to\s+(?:\w+\s+){1,3}/gi,
    /\bsource[d]?\s*:/gi,
    /\bcited?\s+(?:from|in|by)\b/gi,
    /\bstud(?:y|ies)\s+(?:show|found|suggest)/gi,
    /\bresearch\s+(?:show|found|suggest|indicates)/gi,
  ];

  for (const pattern of attributionPhrases) {
    const matches = markdown.match(pattern) ?? [];
    count += matches.length;
  }

  return count;
}

/**
 * Evaluates whether the content includes proper citation formatting.
 *
 * AI search engines prefer content that cites its sources, as this signals
 * credibility. Two or more external links or references are required to pass.
 *
 * @param markdown - Raw markdown content.
 * @returns GeoCheckResult for the citation-formatting criterion.
 */
function checkCitationFormatting(markdown: string): GeoCheckResult {
  const citationCount = countCitations(markdown);
  const suggestions: string[] = [];

  // Score: 0 citations → 0, target (2) → ~50, 4+ → 100
  const score = Math.min(Math.round((citationCount / (CITATION_MIN_COUNT * 2)) * 100), 100);

  if (citationCount === 0) {
    suggestions.push(
      "No external links or citations found. " +
        "Add links to authoritative sources using Markdown syntax: [Source Name](https://example.com)."
    );
    suggestions.push(
      "Perplexity and other AI search engines favour content that references credible sources."
    );
  } else if (citationCount < CITATION_MIN_COUNT) {
    suggestions.push(
      `Only ${citationCount} citation${citationCount > 1 ? "s" : ""} found. ` +
        `Add at least ${CITATION_MIN_COUNT} external links or references for better AI citation likelihood.`
    );
  }

  return {
    id: "citation-formatting",
    name: "Citation Formatting",
    description: "Content links to authoritative external sources that AI engines can verify.",
    passed: citationCount >= CITATION_MIN_COUNT,
    score,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// Check 4: Scannable Sections
// ---------------------------------------------------------------------------

/** Maximum average paragraph word count for content to be considered scannable. */
const MAX_AVG_PARAGRAPH_WORDS = 80;

/**
 * Splits markdown into non-heading, non-code block paragraphs.
 *
 * @param markdown - Raw markdown content.
 * @returns Array of paragraph strings.
 */
export function extractParagraphs(markdown: string): string[] {
  // Remove code blocks first
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");

  return withoutCode
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => {
      if (p.length === 0) return false;
      // Exclude heading lines
      if (/^#{1,6}\s+/.test(p)) return false;
      // Exclude horizontal rules
      if (/^[-*_]{3,}\s*$/.test(p)) return false;
      // Exclude lines that are only list markers
      if (/^[\s]*[-*+]\s+/.test(p) && p.split("\n").every((l) => /^[\s]*[-*+]\s/.test(l) || l.trim() === "")) return false;
      return true;
    });
}

/**
 * Determines whether the markdown contains bullet or numbered list items.
 *
 * @param markdown - Raw markdown content.
 * @returns `true` if at least one list item is present.
 */
export function hasListItems(markdown: string): boolean {
  // Remove code blocks before checking
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  return /^[\s]*[-*+]\s+\S/m.test(withoutCode) || /^\d+\.\s+\S/m.test(withoutCode);
}

/**
 * Evaluates whether the content is structured for easy scanning.
 *
 * AI search engines prefer content that is broken into logical chunks —
 * short paragraphs and/or list items make it easier to extract citations.
 * Passes if content has list items OR average paragraph length ≤ 80 words.
 *
 * @param markdown - Raw markdown content.
 * @returns GeoCheckResult for the scannable-sections criterion.
 */
function checkScannableSections(markdown: string): GeoCheckResult {
  const hasList = hasListItems(markdown);
  const paragraphs = extractParagraphs(markdown);
  const suggestions: string[] = [];

  let avgParagraphWords = 0;
  if (paragraphs.length > 0) {
    const totalWords = paragraphs.reduce(
      (sum, p) => sum + countWords(stripMarkdownForGeo(p)),
      0
    );
    avgParagraphWords = totalWords / paragraphs.length;
  }

  const hasShortParagraphs = avgParagraphWords <= MAX_AVG_PARAGRAPH_WORDS || paragraphs.length === 0;
  const passed = hasList || hasShortParagraphs;

  // Score: 100 if both pass, partial credit otherwise
  let score: number;
  if (hasList && hasShortParagraphs) {
    score = 100;
  } else if (hasList || hasShortParagraphs) {
    score = 65;
  } else {
    score = Math.max(0, Math.round(30 - (avgParagraphWords - MAX_AVG_PARAGRAPH_WORDS) / 5));
  }

  if (!hasList) {
    suggestions.push(
      "Add bullet points or numbered lists to break up information. " +
        "Lists are easily extracted by AI engines for structured answers."
    );
  }

  if (!hasShortParagraphs) {
    suggestions.push(
      `Average paragraph length is ${Math.round(avgParagraphWords)} words ` +
        `(target: ≤ ${MAX_AVG_PARAGRAPH_WORDS} words). ` +
        "Break long paragraphs into shorter, focused chunks."
    );
  }

  return {
    id: "scannable-sections",
    name: "Scannable Sections",
    description: "Content uses lists and short paragraphs that AI engines can parse and cite.",
    passed,
    score,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs all GEO optimization checks on the given markdown content.
 *
 * Checks performed:
 * - Heading structure: logical H1–H6 hierarchy.
 * - Factual density: statistics per 100 words.
 * - Citation formatting: external links and references.
 * - Scannable sections: lists and paragraph length.
 *
 * @param markdown - Raw markdown content to analyse.
 * @returns Complete GEO analysis with per-check results and composite score.
 */
export function analyzeGeo(markdown: string): GeoAnalysisResult {
  if (!markdown || markdown.trim().length === 0) {
    const emptyCheck = (id: GeoCheckId, name: string, description: string): GeoCheckResult => ({
      id,
      name,
      description,
      passed: false,
      score: 0,
      suggestions: ["Add content to enable GEO analysis."],
    });

    const checks: GeoCheckResult[] = [
      emptyCheck("heading-structure", "Clear Heading Structure", "Content uses H1–H6 headings to create a logical hierarchy for AI parsing."),
      emptyCheck("factual-density", "Factual Density", "Content includes statistics and numeric data that AI engines can cite."),
      emptyCheck("citation-formatting", "Citation Formatting", "Content links to authoritative external sources that AI engines can verify."),
      emptyCheck("scannable-sections", "Scannable Sections", "Content uses lists and short paragraphs that AI engines can parse and cite."),
    ];

    return { score: 0, passed: 0, total: checks.length, checks };
  }

  const checks: GeoCheckResult[] = [
    checkHeadingStructure(markdown),
    checkFactualDensity(markdown),
    checkCitationFormatting(markdown),
    checkScannableSections(markdown),
  ];

  const passed = checks.filter((c) => c.passed).length;
  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
  const score = Math.round(totalScore / checks.length);

  return {
    score,
    passed,
    total: checks.length,
    checks,
  };
}
