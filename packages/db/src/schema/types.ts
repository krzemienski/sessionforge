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
