/**
 * Word-level edit distance utilities for tracking writing style changes.
 * Uses Levenshtein distance on word tokens — no external dependencies.
 */

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Compute Levenshtein distance between two arrays using dynamic programming.
 */
function levenshtein(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;

  // dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Returns a normalized 0–1 similarity score between two texts.
 * 1.0 = identical, 0.0 = completely different.
 */
export function computeEditDistance(original: string, edited: string): number {
  const a = tokenize(original);
  const b = tokenize(edited);

  if (a.length === 0 && b.length === 0) return 1;

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);

  return 1 - dist / maxLen;
}

export interface EditStats {
  editDistance: number;
  wordsAdded: number;
  wordsRemoved: number;
  percentChanged: number;
}

/**
 * Returns detailed edit statistics comparing original to edited text.
 */
export function computeEditStats(original: string, edited: string): EditStats {
  const a = tokenize(original);
  const b = tokenize(edited);

  if (a.length === 0 && b.length === 0) {
    return { editDistance: 1, wordsAdded: 0, wordsRemoved: 0, percentChanged: 0 };
  }

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const editDistance = 1 - dist / maxLen;

  // Approximate added/removed using length difference and edit distance
  const lengthDiff = b.length - a.length;
  const wordsChanged = dist;

  // Words added = ops that increased length; words removed = ops that decreased length
  // From LCS perspective: substitutions count as 1 change each,
  // net additions = max(0, lengthDiff), net removals = max(0, -lengthDiff)
  const wordsAdded = Math.max(0, lengthDiff);
  const wordsRemoved = Math.max(0, -lengthDiff);
  const percentChanged = maxLen > 0 ? (wordsChanged / maxLen) * 100 : 0;

  return { editDistance, wordsAdded, wordsRemoved, percentChanged };
}
