/**
 * RiskScorer — matches extracted claims against available evidence and assigns
 * severity levels to produce RiskFlag objects.
 *
 * Takes ClaimExtractionResult[] from the ClaimExtractor and checks each claim
 * against citations, session data, and insight data. Assigns severity based on:
 *   1. Whether the claim has a matching citation
 *   2. How closely evidence supports the claim
 *   3. The type of claim (version-specific = higher risk, opinion = lower risk)
 *
 * Follow the pattern from ClaimExtractor in lib/verification/claim-extractor.ts.
 */

import type {
  ClaimExtractionResult,
  RiskCategory,
  RiskFlag,
  RiskSeverity,
} from "./types";

// ── Evidence Input Types ───────────────────────────────────────────────────

/** A citation from the post's reference list. */
export interface CitationEvidence {
  /** URL or identifier of the citation source. */
  url: string;
  /** Title or label of the citation. */
  title: string;
  /** Optional snippet of text from the cited source. */
  snippet?: string;
}

/** A snippet from a session transcript. */
export interface SessionEvidence {
  /** The session that contains this evidence. */
  sessionId: string;
  /** Index of the message within the session. */
  messageIndex: number;
  /** The text content of the relevant message. */
  text: string;
}

/** An insight generated from session data. */
export interface InsightEvidence {
  /** The insight identifier. */
  insightId: string;
  /** The text content of the insight. */
  text: string;
}

/** All available evidence to match claims against. */
export interface EvidenceContext {
  citations: CitationEvidence[];
  sessions: SessionEvidence[];
  insights: InsightEvidence[];
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Minimum word-overlap ratio to consider evidence a match. */
const MATCH_THRESHOLD = 0.3;

/** Minimum significant word length for matching (ignores short words). */
const MIN_WORD_LENGTH = 4;

/**
 * Maps claim types to their default risk category when no evidence is found.
 */
const CLAIM_TYPE_TO_CATEGORY: Record<
  ClaimExtractionResult["claimType"],
  RiskCategory
> = {
  version_number: "version_specific",
  performance_metric: "unverified_metric",
  api_behavior: "unsupported_claim",
  comparison: "unsupported_claim",
  date_reference: "outdated_info",
  statistic: "unverified_metric",
  general_fact: "unsupported_claim",
};

/**
 * Base severity for each claim type when the claim is unsupported.
 * Version-specific and metric claims are higher risk; general facts lower.
 */
const CLAIM_TYPE_SEVERITY: Record<
  ClaimExtractionResult["claimType"],
  RiskSeverity
> = {
  version_number: "high",
  performance_metric: "high",
  statistic: "high",
  api_behavior: "medium",
  comparison: "medium",
  date_reference: "medium",
  general_fact: "low",
};

/** Ordered severity levels from most to least severe. */
const SEVERITY_ORDER: RiskSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

// ── RiskScorer ─────────────────────────────────────────────────────────────

export class RiskScorer {
  /**
   * Score extracted claims against available evidence and produce risk flags.
   *
   * For each claim, searches all evidence sources for supporting content.
   * Claims without evidence get flagged at the severity appropriate to their
   * type; claims with partial evidence are downgraded; claims with strong
   * evidence are marked as info-level or excluded entirely.
   *
   * @param claims - Extracted claims from ClaimExtractor
   * @param evidence - Available evidence to match against
   * @returns Array of RiskFlag objects for claims that warrant flagging
   *
   * @example
   * ```ts
   * const scorer = new RiskScorer();
   * const flags = scorer.score(claims, {
   *   citations: [{ url: "https://...", title: "React docs", snippet: "..." }],
   *   sessions: [{ sessionId: "s1", messageIndex: 0, text: "..." }],
   *   insights: [],
   * });
   * ```
   */
  score(claims: ClaimExtractionResult[], evidence: EvidenceContext): RiskFlag[] {
    const flags: RiskFlag[] = [];

    for (const claim of claims) {
      const matchResult = this.findBestEvidence(claim, evidence);

      // Strong evidence fully supports the claim — no flag needed
      if (matchResult.strength === "strong") {
        continue;
      }

      const severity = this.computeSeverity(claim, matchResult.strength);
      const category = CLAIM_TYPE_TO_CATEGORY[claim.claimType];

      const flag: RiskFlag = {
        id: this.generateId(claim),
        sentence: claim.sentence,
        severity,
        category,
        evidence: matchResult.snippets,
        status: "unresolved",
      };

      flags.push(flag);
    }

    return flags;
  }

  /**
   * Score claims and return only flags at or above the given severity.
   *
   * @param claims - Extracted claims from ClaimExtractor
   * @param evidence - Available evidence to match against
   * @param minSeverity - Minimum severity to include (default: "low")
   * @returns Filtered array of RiskFlag objects
   *
   * @example
   * ```ts
   * const scorer = new RiskScorer();
   * const criticalFlags = scorer.scoreWithMinSeverity(claims, evidence, "high");
   * ```
   */
  scoreWithMinSeverity(
    claims: ClaimExtractionResult[],
    evidence: EvidenceContext,
    minSeverity: RiskSeverity = "low"
  ): RiskFlag[] {
    const minIndex = SEVERITY_ORDER.indexOf(minSeverity);
    return this.score(claims, evidence).filter((flag) => {
      const flagIndex = SEVERITY_ORDER.indexOf(flag.severity);
      return flagIndex <= minIndex;
    });
  }

  /**
   * Get a summary count of flags by severity.
   *
   * @param flags - Array of risk flags to summarize
   * @returns Record mapping each severity to its count
   *
   * @example
   * ```ts
   * const scorer = new RiskScorer();
   * const flags = scorer.score(claims, evidence);
   * const summary = scorer.summarize(flags);
   * // => { critical: 0, high: 2, medium: 1, low: 3, info: 0 }
   * ```
   */
  summarize(flags: RiskFlag[]): Record<RiskSeverity, number> {
    const counts: Record<RiskSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const flag of flags) {
      counts[flag.severity]++;
    }

    return counts;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Search all evidence sources for the best match to a claim.
   *
   * Returns the match strength ("strong", "partial", or "none") and any
   * evidence snippets that were found.
   */
  private findBestEvidence(
    claim: ClaimExtractionResult,
    evidence: EvidenceContext
  ): {
    strength: "strong" | "partial" | "none";
    snippets: RiskFlag["evidence"];
  } {
    const snippets: RiskFlag["evidence"] = [];
    let bestScore = 0;

    // Check citations
    for (const citation of evidence.citations) {
      const score = this.computeMatchScore(
        claim.sentence,
        citation.snippet ?? citation.title
      );
      if (score > 0) {
        snippets.push({
          text: citation.snippet ?? citation.title,
          type: "citation",
        });
        bestScore = Math.max(bestScore, score);
      }
    }

    // Check session data
    for (const session of evidence.sessions) {
      const score = this.computeMatchScore(claim.sentence, session.text);
      if (score > 0) {
        snippets.push({
          sessionId: session.sessionId,
          messageIndex: session.messageIndex,
          text: this.truncateSnippet(session.text),
          type: "session_snippet",
        });
        bestScore = Math.max(bestScore, score);
      }
    }

    // Check insights
    for (const insight of evidence.insights) {
      const score = this.computeMatchScore(claim.sentence, insight.text);
      if (score > 0) {
        snippets.push({
          text: this.truncateSnippet(insight.text),
          type: "insight",
        });
        bestScore = Math.max(bestScore, score);
      }
    }

    // Classify match strength based on the best score
    const strength =
      bestScore >= 0.6 ? "strong" : bestScore >= MATCH_THRESHOLD ? "partial" : "none";

    return { strength, snippets };
  }

  /**
   * Compute a word-overlap match score between a claim and evidence text.
   *
   * Extracts significant words (length >= MIN_WORD_LENGTH) from both strings,
   * then computes the ratio of shared words to claim words. Returns a value
   * between 0 and 1.
   */
  private computeMatchScore(claim: string, evidenceText: string): number {
    const claimWords = this.extractSignificantWords(claim);
    const evidenceWords = this.extractSignificantWords(evidenceText);

    if (claimWords.size === 0) {
      return 0;
    }

    let matches = 0;
    for (const word of claimWords) {
      if (evidenceWords.has(word)) {
        matches++;
      }
    }

    return matches / claimWords.size;
  }

  /**
   * Extract significant words from text for matching.
   *
   * Lowercases, strips punctuation, and filters out short words to focus
   * on meaningful content words.
   */
  private extractSignificantWords(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= MIN_WORD_LENGTH);

    return new Set(words);
  }

  /**
   * Compute the final severity for a claim based on its type and evidence strength.
   *
   * - No evidence: use the base severity for the claim type
   * - Partial evidence: downgrade severity by one level
   * - High confidence claims without evidence get bumped up
   */
  private computeSeverity(
    claim: ClaimExtractionResult,
    evidenceStrength: "partial" | "none"
  ): RiskSeverity {
    const baseSeverity = CLAIM_TYPE_SEVERITY[claim.claimType];
    const baseIndex = SEVERITY_ORDER.indexOf(baseSeverity);

    if (evidenceStrength === "partial") {
      // Downgrade by one level when partial evidence exists
      const downgraded = Math.min(baseIndex + 1, SEVERITY_ORDER.length - 1);
      return SEVERITY_ORDER[downgraded]!;
    }

    // No evidence: high-confidence claims get bumped up
    if (claim.confidence >= 0.85 && baseIndex > 0) {
      return SEVERITY_ORDER[baseIndex - 1]!;
    }

    return baseSeverity;
  }

  /**
   * Generate a deterministic ID for a claim-based risk flag.
   *
   * Uses a simple hash of the sentence and offset to produce a stable
   * identifier that won't change across re-runs on the same content.
   */
  private generateId(claim: ClaimExtractionResult): string {
    const input = `${claim.sentence}:${claim.startOffset}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return `rf_${hex}`;
  }

  /**
   * Truncate an evidence snippet to a reasonable display length.
   *
   * Cuts at the nearest word boundary to avoid breaking mid-word.
   */
  private truncateSnippet(text: string, maxLength = 200): string {
    if (text.length <= maxLength) {
      return text;
    }

    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "…";
  }
}
