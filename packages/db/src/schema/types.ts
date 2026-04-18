/**
 * Loose shape for JSON-LD structured data stored in `posts.structuredData`.
 * Intentionally `unknown`-typed object: the app ships a stricter
 * discriminated union (`StructuredData` in seo/structured-data-generator.ts)
 * that callers narrow to. Using `unknown` here keeps the DB package free of
 * any app dependency and lets all concrete schema shapes assign in without an
 * index-signature mismatch. Readers must narrow at use (zod or a type guard).
 */
export type StructuredDataJson = Record<string, unknown>;

export interface SeoMetadata {
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  additionalKeywords?: string[] | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterCard?: string | null;
  schemaOrg?: Record<string, unknown> | null;
  readabilityScore?: number | null;
  readabilityGrade?: string | null;
  seoScore?: number | null;
  keywordDensity?: number | null;
  suggestedKeywords?: string[] | null;
  generatedAt?: string | null;
}

export interface RiskFlag {
  id: string;
  sentence: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category:
    | "unsupported_claim"
    | "outdated_info"
    | "version_specific"
    | "subjective_opinion"
    | "unverified_metric";
  evidence: {
    sessionId?: string;
    messageIndex?: number;
    text: string;
    type: "session_snippet" | "insight" | "citation";
  }[];
  status: "unresolved" | "verified" | "dismissed" | "overridden";
  resolvedBy?: string | null;
  resolvedAt?: string | null;
}

export interface AiPatternMatch {
  phrase: string;
  category: string;
  suggestion: string;
}
