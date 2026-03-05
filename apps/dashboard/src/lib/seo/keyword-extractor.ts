/**
 * Keyword extraction service that uses TF-IDF analysis to identify
 * relevant keywords from markdown content and session insights.
 */

/** A keyword with relevance and frequency data. */
export interface ExtractedKeyword {
  /** The keyword or key phrase. */
  keyword: string;
  /** Relevance score from 0 to 1 based on TF-IDF weighting. */
  relevance: number;
  /** Number of times the keyword appears in the content. */
  frequency: number;
}

/** Options for keyword extraction. */
export interface KeywordExtractionOptions {
  /** Maximum number of keywords to return. Defaults to 20. */
  maxKeywords?: number;
  /** Minimum frequency for a keyword to be included. Defaults to 1. */
  minFrequency?: number;
  /** Whether to include bigrams (two-word phrases). Defaults to true. */
  includePhrases?: boolean;
}

/**
 * Common English stop words to exclude from keyword extraction.
 * Includes articles, prepositions, conjunctions, and common verbs.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "can", "shall", "that",
  "this", "these", "those", "it", "its", "we", "you", "he", "she", "they",
  "i", "me", "my", "your", "his", "her", "our", "their", "what", "which",
  "who", "when", "where", "why", "how", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "no", "not", "only",
  "same", "so", "than", "too", "very", "s", "t", "just", "don", "about",
  "also", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "up", "down", "then", "once", "here", "there", "any",
  "if", "because", "while", "although", "however", "therefore", "thus",
  "whether", "though", "since", "unless", "until", "within", "without",
  "using", "used", "use", "make", "made", "get", "got", "let", "set",
  "new", "old", "first", "last", "long", "little", "own", "right",
  "still", "even", "back", "well", "way", "need", "wants", "said", "says",
]);

/**
 * Strips markdown formatting to extract plain text.
 * Removes code blocks, headings, emphasis, links, and inline code.
 *
 * @param markdown - Raw markdown string to clean.
 * @returns Plain text with markdown syntax removed.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    // Remove fenced code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // Remove inline code
    .replace(/`[^`]*`/g, " ")
    // Remove HTML tags
    .replace(/<[^>]+>/g, " ")
    // Remove markdown headings
    .replace(/^#{1,6}\s+/gm, "")
    // Remove markdown links - keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown images
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    // Remove bold/italic markers
    .replace(/\*{1,3}|_{1,3}/g, "")
    // Remove blockquotes
    .replace(/^>\s*/gm, "")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Remove list markers
    .replace(/^[\s-*+]+/gm, " ")
    // Remove numbered list markers
    .replace(/^\d+\.\s+/gm, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenises plain text into lowercase alphabetic words.
 *
 * @param text - Plain text to tokenise.
 * @returns Array of lowercase word tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/**
 * Computes term frequency (TF) for each token in the list.
 *
 * @param tokens - Array of word tokens.
 * @returns Map of token to its raw frequency count.
 */
function computeTermFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

/**
 * Builds bigram phrases from a token list.
 * Filters out bigrams containing stop words.
 *
 * @param tokens - Array of word tokens (stop words already removed).
 * @param rawTokens - Full token list before stop-word removal, for positional bigrams.
 * @returns Map of bigram phrase to its frequency.
 */
function computeBigrams(rawText: string): Map<string, number> {
  const freq = new Map<string, number>();
  // Tokenize without stop-word filtering to preserve positions
  const allTokens = rawText
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 1);

  for (let i = 0; i < allTokens.length - 1; i++) {
    const a = allTokens[i];
    const b = allTokens[i + 1];
    // Both words must not be stop words
    if (!STOP_WORDS.has(a) && !STOP_WORDS.has(b) && a.length > 2 && b.length > 2) {
      const bigram = `${a} ${b}`;
      freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
    }
  }
  return freq;
}

/**
 * Applies a logarithmic TF-IDF-inspired relevance score.
 * Since we operate on a single document, IDF is approximated by
 * penalising very common short words and rewarding longer, rarer terms.
 *
 * @param term - The keyword or phrase.
 * @param frequency - Raw frequency count in the document.
 * @param totalTokens - Total token count in the document.
 * @returns Normalised relevance score between 0 and 1.
 */
function scoreRelevance(term: string, frequency: number, totalTokens: number): number {
  if (totalTokens === 0) return 0;

  // Term frequency normalised by document length
  const tf = frequency / totalTokens;

  // Length bonus: longer terms are generally more specific
  const lengthBonus = Math.min(term.replace(" ", "").length / 12, 1);

  // Phrase bonus for bigrams (contain a space)
  const phraseBonus = term.includes(" ") ? 1.4 : 1.0;

  // Logarithmic scaling to avoid domination by high-frequency common terms
  const rawScore = (1 + Math.log(frequency)) * tf * lengthBonus * phraseBonus;

  return rawScore;
}

/**
 * Normalises an array of raw scores to the 0–1 range.
 *
 * @param items - Items with a raw score field.
 * @returns Items with the score normalised to 0–1.
 */
function normaliseScores(
  items: Array<{ keyword: string; frequency: number; rawScore: number }>
): ExtractedKeyword[] {
  if (items.length === 0) return [];

  const maxScore = Math.max(...items.map((k) => k.rawScore));
  if (maxScore === 0) {
    return items.map(({ keyword, frequency }) => ({ keyword, relevance: 0, frequency }));
  }

  return items.map(({ keyword, frequency, rawScore }) => ({
    keyword,
    frequency,
    relevance: Math.round((rawScore / maxScore) * 1000) / 1000,
  }));
}

/**
 * Extracts keywords and key phrases from markdown content using
 * TF-IDF-inspired frequency analysis.
 *
 * Strips markdown, tokenises, removes stop words, optionally extracts
 * bigrams, then scores and ranks terms by relevance.
 *
 * @param markdown - The markdown content to analyse.
 * @param options - Configuration for extraction behaviour.
 * @returns Ranked array of extracted keywords with relevance and frequency.
 */
export function extractKeywords(
  markdown: string,
  options: KeywordExtractionOptions = {}
): ExtractedKeyword[] {
  const { maxKeywords = 20, minFrequency = 1, includePhrases = true } = options;

  if (!markdown || markdown.trim().length === 0) {
    return [];
  }

  const plainText = stripMarkdown(markdown);
  const tokens = tokenize(plainText);
  const totalTokens = tokens.length;

  if (totalTokens === 0) {
    return [];
  }

  const unigramFreq = computeTermFrequency(tokens);
  const allTerms = new Map<string, number>(unigramFreq);

  if (includePhrases) {
    const bigramFreq = computeBigrams(plainText);
    for (const [bigram, count] of bigramFreq) {
      if (count >= minFrequency) {
        allTerms.set(bigram, count);
      }
    }
  }

  const scored = Array.from(allTerms.entries())
    .filter(([, freq]) => freq >= minFrequency)
    .map(([term, frequency]) => ({
      keyword: term,
      frequency,
      rawScore: scoreRelevance(term, frequency, totalTokens),
    }));

  scored.sort((a, b) => b.rawScore - a.rawScore);

  const topScored = scored.slice(0, maxKeywords * 2);
  const normalised = normaliseScores(topScored);

  return normalised.slice(0, maxKeywords);
}

/**
 * Merges keywords extracted from multiple content sources.
 * Combines frequency counts and recalculates relevance across all sources.
 *
 * @param sources - Array of markdown strings to analyse together.
 * @param options - Configuration for extraction behaviour.
 * @returns Merged and ranked keyword list.
 */
export function extractKeywordsFromSources(
  sources: string[],
  options: KeywordExtractionOptions = {}
): ExtractedKeyword[] {
  const combined = sources.filter(Boolean).join("\n\n");
  return extractKeywords(combined, options);
}
