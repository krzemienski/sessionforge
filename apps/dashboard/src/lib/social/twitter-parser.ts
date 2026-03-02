export interface ParsedTweet {
  index: number;
  text: string;
  charCount: number;
  isWarning: boolean;
  isError: boolean;
}

export interface TwitterThreadResult {
  tweets: ParsedTweet[];
  totalCount: number;
}

const TWEET_WARN_THRESHOLD = 260;
const TWEET_ERROR_THRESHOLD = 280;

/**
 * Strips the leading "N/ " numbering prefix from a tweet line.
 * Handles formats like "1/ ", "12/ ", etc.
 */
function stripNumberPrefix(text: string): string {
  return text.replace(/^\d+\/\s*/, "");
}

/**
 * Parses a Twitter thread in markdown format into structured tweet objects.
 *
 * Input format (as produced by the AI prompt):
 *   1/ First tweet content
 *   ---
 *   2/ Second tweet content
 *
 * Returns an array of parsed tweets with character count metadata and a
 * totalCount used to render 1/N numbering in the UI.
 */
export function parseTwitterThread(markdown: string): TwitterThreadResult {
  if (!markdown || !markdown.trim()) {
    return { tweets: [], totalCount: 0 };
  }

  const segments = markdown
    .split(/\n?---\n?/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const totalCount = segments.length;

  const tweets: ParsedTweet[] = segments.map((segment, i) => {
    const text = stripNumberPrefix(segment).trim();
    const charCount = text.length;

    return {
      index: i,
      text,
      charCount,
      isWarning: charCount >= TWEET_WARN_THRESHOLD && charCount < TWEET_ERROR_THRESHOLD,
      isError: charCount >= TWEET_ERROR_THRESHOLD,
    };
  });

  return { tweets, totalCount };
}
