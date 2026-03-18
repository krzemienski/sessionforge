/**
 * AI writing pattern detection library.
 * Identifies phrases and patterns commonly produced by AI language models,
 * helping writers craft more authentic, human-sounding prose.
 */

/** Category of AI-tell pattern. */
export type AiPatternCategory =
  | "hedge-words"
  | "filler-phrases"
  | "corporate-speak"
  | "ai-signatures";

/** A single detected AI pattern match within text. */
export interface AiPatternMatch {
  /** The matched phrase as it appears in the original text. */
  phrase: string;
  /** Zero-based character index where the match begins. */
  startIndex: number;
  /** Zero-based character index immediately after the match ends. */
  endIndex: number;
  /** The category this pattern belongs to. */
  category: AiPatternCategory;
  /** Human-readable suggestion for replacing or removing the phrase. */
  suggestion: string;
}

/** A single entry in the AI pattern dictionary. */
export interface AiPatternEntry {
  /** The phrase to detect (matched case-insensitively). */
  phrase: string;
  /** Category this phrase belongs to. */
  category: AiPatternCategory;
  /** Replacement or rewrite suggestion shown to the writer. */
  suggestion: string;
}

/**
 * Comprehensive dictionary of AI-tell phrases organised by category.
 * Contains at least 30 entries covering hedge words, filler phrases,
 * corporate-speak, and AI response signatures.
 *
 * Sorted within each category from most-distinctive to less-distinctive
 * so the most confident detections appear first in results.
 */
export const AI_PATTERN_DICTIONARY: AiPatternEntry[] = [
  // ── Hedge words ─────────────────────────────────────────────────────────
  {
    phrase: "delve",
    category: "hedge-words",
    suggestion: 'Replace "delve" with a direct verb: "explore", "examine", or "look at".',
  },
  {
    phrase: "leverage",
    category: "hedge-words",
    suggestion: 'Replace "leverage" with "use" or "apply" for clearer, simpler prose.',
  },
  {
    phrase: "utilize",
    category: "hedge-words",
    suggestion: '"Utilize" is rarely better than "use". Prefer the shorter word.',
  },
  {
    phrase: "facilitate",
    category: "hedge-words",
    suggestion: 'Try "help", "enable", or "make easier" instead of "facilitate".',
  },
  {
    phrase: "endeavour",
    category: "hedge-words",
    suggestion: 'Replace "endeavour" with "try" or "attempt" for plain language.',
  },
  {
    phrase: "endeavor",
    category: "hedge-words",
    suggestion: 'Replace "endeavor" with "try" or "attempt" for plain language.',
  },
  {
    phrase: "underscore",
    category: "hedge-words",
    suggestion: 'Replace "underscore" with "highlight" or "emphasise".',
  },
  {
    phrase: "elucidate",
    category: "hedge-words",
    suggestion: '"Elucidate" sounds overly formal. Use "clarify" or "explain".',
  },
  {
    phrase: "pivotal",
    category: "hedge-words",
    suggestion: '"Pivotal" is overused. Try "key", "critical", or "central".',
  },

  // ── Filler phrases ───────────────────────────────────────────────────────
  {
    phrase: "it is important to note",
    category: "filler-phrases",
    suggestion: 'Remove "it is important to note" — state the point directly.',
  },
  {
    phrase: "it is worth noting",
    category: "filler-phrases",
    suggestion: 'Cut "it is worth noting" and lead with the observation itself.',
  },
  {
    phrase: "it's worth noting",
    category: "filler-phrases",
    suggestion: 'Cut "it\'s worth noting" and lead with the observation itself.',
  },
  {
    phrase: "in the realm of",
    category: "filler-phrases",
    suggestion: 'Replace "in the realm of" with a specific noun: "in machine learning", "in finance".',
  },
  {
    phrase: "in conclusion",
    category: "filler-phrases",
    suggestion: 'Drop "in conclusion" — your closing paragraph implies it.',
  },
  {
    phrase: "in summary",
    category: "filler-phrases",
    suggestion: 'Drop "in summary" and let the content speak for itself.',
  },
  {
    phrase: "to summarize",
    category: "filler-phrases",
    suggestion: 'Cut "to summarize" — your summary paragraph is self-evident.',
  },
  {
    phrase: "as mentioned earlier",
    category: "filler-phrases",
    suggestion: 'Remove "as mentioned earlier" or restructure to avoid repetition.',
  },
  {
    phrase: "needless to say",
    category: "filler-phrases",
    suggestion: 'If it is needless to say, omit it entirely.',
  },
  {
    phrase: "it goes without saying",
    category: "filler-phrases",
    suggestion: 'Cut "it goes without saying" — if it goes without saying, don\'t say it.',
  },
  {
    phrase: "at the end of the day",
    category: "filler-phrases",
    suggestion: '"At the end of the day" is a cliché. State your conclusion directly.',
  },

  // ── Corporate-speak ──────────────────────────────────────────────────────
  {
    phrase: "synergy",
    category: "corporate-speak",
    suggestion: 'Replace "synergy" with the specific benefit: "combined output", "shared efficiency".',
  },
  {
    phrase: "paradigm shift",
    category: "corporate-speak",
    suggestion: '"Paradigm shift" is overused jargon. Describe the actual change.',
  },
  {
    phrase: "actionable insights",
    category: "corporate-speak",
    suggestion: 'Replace "actionable insights" with the specific findings or next steps.',
  },
  {
    phrase: "game-changing",
    category: "corporate-speak",
    suggestion: '"Game-changing" is vague hyperbole. Describe what actually changes.',
  },
  {
    phrase: "seamlessly",
    category: "corporate-speak",
    suggestion: '"Seamlessly" is marketing filler. Describe how things actually integrate.',
  },
  {
    phrase: "robust",
    category: "corporate-speak",
    suggestion: '"Robust" is often empty. Specify what makes it reliable or capable.',
  },
  {
    phrase: "scalable",
    category: "corporate-speak",
    suggestion: 'Explain how it scales instead of using the vague term "scalable".',
  },
  {
    phrase: "cutting-edge",
    category: "corporate-speak",
    suggestion: '"Cutting-edge" is a cliché. Name the specific technology or approach.',
  },
  {
    phrase: "best-in-class",
    category: "corporate-speak",
    suggestion: 'Back up "best-in-class" with evidence, or rephrase with specifics.',
  },
  {
    phrase: "move the needle",
    category: "corporate-speak",
    suggestion: 'Replace "move the needle" with a concrete metric or outcome.',
  },

  // ── AI signatures ────────────────────────────────────────────────────────
  {
    phrase: "certainly!",
    category: "ai-signatures",
    suggestion: 'Delete the filler opener "Certainly!" and begin with your actual content.',
  },
  {
    phrase: "absolutely!",
    category: "ai-signatures",
    suggestion: 'Delete the filler opener "Absolutely!" and begin with your actual content.',
  },
  {
    phrase: "of course!",
    category: "ai-signatures",
    suggestion: 'Delete the filler opener "Of course!" and begin with your actual content.',
  },
  {
    phrase: "I hope this helps",
    category: "ai-signatures",
    suggestion: 'Remove "I hope this helps" — it adds no value and signals AI origin.',
  },
  {
    phrase: "feel free to",
    category: "ai-signatures",
    suggestion: 'Cut "feel free to" — readers already know they may ask follow-up questions.',
  },
  {
    phrase: "great question",
    category: "ai-signatures",
    suggestion: '"Great question" is a hollow opener. Begin your answer directly.',
  },
  {
    phrase: "I'd be happy to",
    category: "ai-signatures",
    suggestion: 'Cut "I\'d be happy to" — proceed to the content without the pleasantry.',
  },
  {
    phrase: "I'll do my best",
    category: "ai-signatures",
    suggestion: '"I\'ll do my best" is unnecessary hedging. Provide your answer directly.',
  },
];

/**
 * Builds a case-insensitive regular expression that matches a literal phrase
 * at word boundaries where appropriate.
 *
 * Phrases ending or beginning with punctuation (e.g. "certainly!") use a
 * simpler boundary based on position rather than `\b` which does not work
 * next to non-word characters.
 *
 * @param phrase - The literal phrase to match.
 * @returns A RegExp with the global and case-insensitive flags set.
 */
function buildPhraseRegex(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const startsWithWord = /^\w/.test(phrase);
  const endsWithWord = /\w$/.test(phrase);

  const prefix = startsWithWord ? "(?<![\\w])" : "(?<![\\w\\s])";
  const suffix = endsWithWord ? "(?![\\w])" : "";

  return new RegExp(`${prefix}${escaped}${suffix}`, "gi");
}

/**
 * Scans the provided text for AI-tell phrases and returns all matches with
 * their positions and improvement suggestions.
 *
 * Matches are returned in document order (ascending `startIndex`).
 * Overlapping matches for the same character range are de-duplicated, keeping
 * the longer (more specific) phrase.
 *
 * @param text - The raw text to analyse (plain text or markdown).
 * @returns Array of AI pattern matches found in the text.
 */
export function detectAiPatterns(text: string): AiPatternMatch[] {
  if (!text || text.trim().length === 0) return [];

  const rawMatches: AiPatternMatch[] = [];

  for (const entry of AI_PATTERN_DICTIONARY) {
    const regex = buildPhraseRegex(entry.phrase);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      rawMatches.push({
        phrase: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        category: entry.category,
        suggestion: entry.suggestion,
      });
    }
  }

  // Sort by start index ascending
  rawMatches.sort((a, b) => a.startIndex - b.startIndex || b.phrase.length - a.phrase.length);

  // De-duplicate overlapping ranges: keep the longer match when two overlap
  const deduped: AiPatternMatch[] = [];
  for (const candidate of rawMatches) {
    const last = deduped[deduped.length - 1];
    if (last && candidate.startIndex < last.endIndex) {
      // Overlaps with previous — keep whichever is longer
      if (candidate.phrase.length > last.phrase.length) {
        deduped[deduped.length - 1] = candidate;
      }
    } else {
      deduped.push(candidate);
    }
  }

  return deduped;
}
