/**
 * Readability scoring service using the Flesch-Kincaid algorithm.
 * Analyses markdown content to produce reading ease scores, grade levels,
 * and actionable improvement suggestions.
 */

/** Reading ease classification based on Flesch score ranges. */
export type ReadingLevel =
  | "very-easy"
  | "easy"
  | "fairly-easy"
  | "standard"
  | "fairly-difficult"
  | "difficult"
  | "very-difficult";

/** A readability improvement suggestion. */
export interface ReadabilitySuggestion {
  /** Category of the suggestion. */
  type: "sentence-length" | "passive-voice" | "complex-words" | "paragraph-length";
  /** Human-readable description of the issue. */
  message: string;
  /** Severity of the issue. */
  severity: "low" | "medium" | "high";
}

/** Complete readability analysis result. */
export interface ReadabilityScore {
  /**
   * Flesch Reading Ease score from 0 to 100.
   * Higher scores indicate easier reading (90-100 = very easy, <30 = very difficult).
   */
  score: number;
  /**
   * Flesch-Kincaid Grade Level approximating US school grade.
   * E.g. 8 means an 8th grader can understand the text.
   */
  gradeLevel: number;
  /** Human-readable label for the reading ease level. */
  readingLevel: ReadingLevel;
  /** Total word count in the analysed content. */
  wordCount: number;
  /** Total sentence count. */
  sentenceCount: number;
  /** Average words per sentence. */
  averageSentenceLength: number;
  /** Average syllables per word. */
  averageSyllablesPerWord: number;
  /** Actionable suggestions to improve readability. */
  suggestions: ReadabilitySuggestion[];
}

/**
 * Passive voice indicator phrases commonly found in English passive constructions.
 * Matches "was/were/is/are/been/being + past participle" patterns.
 */
const PASSIVE_VOICE_PATTERN =
  /\b(am|is|are|was|were|be|been|being)\s+\w+ed\b/gi;

/**
 * Words considered complex due to syllable count (3+ syllables).
 * Additional domain-specific simple words to exclude from complexity counts.
 */
const SIMPLE_LONG_WORDS = new Set([
  "information", "development", "application", "environment", "configuration",
  "implementation", "understanding", "international", "organization", "communication",
]);

/**
 * Strips markdown syntax from content to produce plain text suitable for analysis.
 * Removes code blocks first to avoid counting code tokens as words.
 *
 * @param markdown - Raw markdown string.
 * @returns Plain text with markdown syntax removed.
 */
export function stripMarkdownForReadability(markdown: string): string {
  return markdown
    // Remove fenced code blocks entirely (don't count code as prose)
    .replace(/```[\s\S]*?```/g, " ")
    // Remove inline code
    .replace(/`[^`]*`/g, " ")
    // Remove HTML tags
    .replace(/<[^>]+>/g, " ")
    // Remove markdown images
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    // Remove markdown links - keep text
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
 * Splits plain text into individual sentences.
 * Handles common abbreviations to avoid false splits (e.g. "Dr.", "vs.").
 *
 * @param text - Plain text to split.
 * @returns Array of non-empty sentence strings.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  // Temporarily protect common abbreviations
  const protected_ = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|Fig|Vol|No)\./gi, "$1<DOT>")
    .replace(/\b([A-Z])\./g, "$1<DOT>");

  const sentences = protected_
    .split(/[.!?]+\s+|[.!?]+$/)
    .map((s) => s.replace(/<DOT>/g, ".").trim())
    .filter((s) => s.length > 0 && /\w/.test(s));

  return sentences;
}

/**
 * Counts the number of syllables in an English word using heuristic rules.
 * Accuracy is approximate (~80-90%) — sufficient for Flesch-Kincaid purposes.
 *
 * @param word - Lowercase word to count syllables for.
 * @returns Estimated syllable count (minimum 1).
 */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  if (cleaned.length <= 3) return 1;

  let count = 0;
  let prevWasVowel = false;

  // Remove trailing silent e
  const processed = cleaned.replace(/e$/, "");

  for (const char of processed) {
    const isVowel = "aeiouy".includes(char);
    if (isVowel && !prevWasVowel) {
      count++;
    }
    prevWasVowel = isVowel;
  }

  // Adjust for common patterns
  // "le" ending counts as syllable when preceded by consonant
  if (cleaned.match(/[^aeiou]le$/)) count++;
  // "es", "ed" endings don't always add syllables
  if (cleaned.match(/[^aeiou]es$/) || cleaned.match(/[^aeiou]ed$/)) count = Math.max(count - 1, 1);

  return Math.max(count, 1);
}

/**
 * Splits text into words, filtering out empty tokens and punctuation-only tokens.
 *
 * @param text - Plain text to split.
 * @returns Array of word strings.
 */
export function splitIntoWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""))
    .filter((w) => w.length > 0 && /[a-zA-Z]/.test(w));
}

/**
 * Maps a Flesch Reading Ease score to a human-readable level label.
 *
 * @param score - Flesch Reading Ease score (0–100).
 * @returns Descriptive reading level string.
 */
export function getReadingLevel(score: number): ReadingLevel {
  if (score >= 90) return "very-easy";
  if (score >= 80) return "easy";
  if (score >= 70) return "fairly-easy";
  if (score >= 60) return "standard";
  if (score >= 50) return "fairly-difficult";
  if (score >= 30) return "difficult";
  return "very-difficult";
}

/**
 * Detects passive voice constructions in the given text.
 *
 * @param text - Plain text to scan.
 * @returns Number of passive voice instances found.
 */
function countPassiveVoice(text: string): number {
  const matches = text.match(PASSIVE_VOICE_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Counts words with 3 or more syllables (considered complex).
 * Excludes proper nouns and words in the simple-long-words exclusion list.
 *
 * @param words - Array of words to analyse.
 * @returns Count of complex words.
 */
function countComplexWords(words: string[]): number {
  return words.filter((word) => {
    const lower = word.toLowerCase();
    if (SIMPLE_LONG_WORDS.has(lower)) return false;
    return countSyllables(lower) >= 3;
  }).length;
}

/**
 * Identifies sentences that exceed a target length threshold.
 *
 * @param sentences - Array of sentence strings.
 * @param threshold - Word count above which a sentence is considered long. Defaults to 25.
 * @returns Array of long sentences with their word counts.
 */
function findLongSentences(
  sentences: string[],
  threshold = 25
): Array<{ sentence: string; wordCount: number }> {
  return sentences
    .map((s) => ({ sentence: s, wordCount: splitIntoWords(s).length }))
    .filter(({ wordCount }) => wordCount > threshold);
}

/**
 * Generates improvement suggestions based on readability metrics.
 *
 * @param score - Flesch Reading Ease score.
 * @param sentences - Array of sentences from the content.
 * @param words - Array of words from the content.
 * @param plainText - Full plain text for passive voice detection.
 * @returns Array of prioritised improvement suggestions.
 */
function generateSuggestions(
  score: number,
  sentences: string[],
  words: string[],
  plainText: string
): ReadabilitySuggestion[] {
  const suggestions: ReadabilitySuggestion[] = [];

  // Check average sentence length
  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
  if (avgSentenceLength > 25) {
    suggestions.push({
      type: "sentence-length",
      message: `Average sentence length is ${Math.round(avgSentenceLength)} words. Aim for under 20 words per sentence to improve clarity.`,
      severity: avgSentenceLength > 35 ? "high" : "medium",
    });
  } else if (avgSentenceLength > 20) {
    suggestions.push({
      type: "sentence-length",
      message: `Average sentence length is ${Math.round(avgSentenceLength)} words. Consider breaking some sentences down further.`,
      severity: "low",
    });
  }

  // Check for individual very long sentences
  const longSentences = findLongSentences(sentences, 35);
  if (longSentences.length > 0) {
    suggestions.push({
      type: "sentence-length",
      message: `${longSentences.length} sentence${longSentences.length > 1 ? "s exceed" : " exceeds"} 35 words. Break these into shorter sentences for better readability.`,
      severity: "high",
    });
  }

  // Check passive voice usage
  const passiveCount = countPassiveVoice(plainText);
  const passiveRate = sentences.length > 0 ? passiveCount / sentences.length : 0;
  if (passiveRate > 0.3) {
    suggestions.push({
      type: "passive-voice",
      message: `High passive voice usage detected (${passiveCount} instance${passiveCount > 1 ? "s" : ""}). Use active voice to make writing more direct and engaging.`,
      severity: passiveRate > 0.5 ? "high" : "medium",
    });
  } else if (passiveRate > 0.15 && passiveCount >= 2) {
    suggestions.push({
      type: "passive-voice",
      message: `${passiveCount} passive voice instance${passiveCount > 1 ? "s" : ""} found. Consider rewriting some in active voice.`,
      severity: "low",
    });
  }

  // Check complex word density
  const complexWordCount = countComplexWords(words);
  const complexWordRate = words.length > 0 ? complexWordCount / words.length : 0;
  if (complexWordRate > 0.2) {
    suggestions.push({
      type: "complex-words",
      message: `${Math.round(complexWordRate * 100)}% of words have 3+ syllables. Replace complex words with simpler alternatives where possible.`,
      severity: complexWordRate > 0.3 ? "high" : "medium",
    });
  } else if (complexWordRate > 0.12) {
    suggestions.push({
      type: "complex-words",
      message: `Some complex words detected (${complexWordCount}). Consider simpler alternatives for technical terms your audience may not know.`,
      severity: "low",
    });
  }

  return suggestions;
}

/**
 * Calculates the Flesch Reading Ease score for the given markdown content.
 *
 * Formula: 206.835 - 1.015 × (words/sentences) - 84.6 × (syllables/words)
 *
 * Scores: 90–100 very easy, 80–90 easy, 70–80 fairly easy, 60–70 standard,
 * 50–60 fairly difficult, 30–50 difficult, 0–30 very difficult.
 *
 * @param markdown - Markdown content to analyse.
 * @returns Full readability analysis including score, grade level, and suggestions.
 */
export function scoreReadability(markdown: string): ReadabilityScore {
  if (!markdown || markdown.trim().length === 0) {
    return {
      score: 0,
      gradeLevel: 0,
      readingLevel: "very-difficult",
      wordCount: 0,
      sentenceCount: 0,
      averageSentenceLength: 0,
      averageSyllablesPerWord: 0,
      suggestions: [],
    };
  }

  const plainText = stripMarkdownForReadability(markdown);
  const sentences = splitIntoSentences(plainText);
  const words = splitIntoWords(plainText);

  const wordCount = words.length;
  const sentenceCount = sentences.length;

  if (wordCount === 0 || sentenceCount === 0) {
    return {
      score: 0,
      gradeLevel: 0,
      readingLevel: "very-difficult",
      wordCount,
      sentenceCount,
      averageSentenceLength: 0,
      averageSyllablesPerWord: 0,
      suggestions: [],
    };
  }

  const totalSyllables = words.reduce(
    (sum, word) => sum + countSyllables(word.toLowerCase()),
    0
  );

  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / wordCount;

  // Flesch Reading Ease formula
  const rawScore =
    206.835 -
    1.015 * avgWordsPerSentence -
    84.6 * avgSyllablesPerWord;

  // Clamp to [0, 100]
  const score = Math.round(Math.max(0, Math.min(100, rawScore)) * 10) / 10;

  // Flesch-Kincaid Grade Level formula
  const rawGradeLevel =
    0.39 * avgWordsPerSentence +
    11.8 * avgSyllablesPerWord -
    15.59;

  const gradeLevel = Math.round(Math.max(0, rawGradeLevel) * 10) / 10;

  const suggestions = generateSuggestions(score, sentences, words, plainText);

  return {
    score,
    gradeLevel,
    readingLevel: getReadingLevel(score),
    wordCount,
    sentenceCount,
    averageSentenceLength: Math.round(avgWordsPerSentence * 10) / 10,
    averageSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    suggestions,
  };
}
