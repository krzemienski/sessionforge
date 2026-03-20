// ── Risk Flag Types ────────────────────────────────────────────────────────
// Shared types for the claim verification system.
// DB enums and the RiskFlag interface live in @repo/db/schema;
// this module re-exports them and adds dashboard-specific types.

import type { RiskFlag } from "@sessionforge/db";

// ── Re-exports from schema ────────────────────────────────────────────────

export type { RiskFlag } from "@sessionforge/db";

// ── Severity & Category unions ─────────────────────────────────────────────

export type RiskSeverity = RiskFlag["severity"];

export type RiskCategory = RiskFlag["category"];

export type FlagStatus = RiskFlag["status"];

export type VerificationStatus = "unverified" | "pending" | "verified" | "has_issues";

// ── Risk Flag Resolution ───────────────────────────────────────────────────

export interface RiskFlagResolution {
  id: string;
  postId: string;
  flagId: string;
  status: FlagStatus;
  resolvedBy: string;
  resolvedAt: string;
  notes?: string | null;
  evidenceSnippet?: string | null;
}

// ── Claim Extraction ───────────────────────────────────────────────────────

export interface ClaimExtractionResult {
  /** The raw sentence text containing the claim. */
  sentence: string;
  /** Zero-based character offset in the source markdown. */
  startOffset: number;
  /** Zero-based character end offset in the source markdown. */
  endOffset: number;
  /** The type of factual assertion detected. */
  claimType:
    | "version_number"
    | "performance_metric"
    | "api_behavior"
    | "comparison"
    | "date_reference"
    | "statistic"
    | "general_fact";
  /** Confidence that this sentence is a verifiable factual claim (0-1). */
  confidence: number;
}

// ── Verification Result ────────────────────────────────────────────────────

export interface VerificationResult {
  /** The post that was verified. */
  postId: string;
  /** When the verification was run. */
  verifiedAt: string;
  /** Overall status after verification. */
  status: VerificationStatus;
  /** All risk flags produced by the verification pass. */
  flags: RiskFlag[];
  /** Summary statistics. */
  summary: VerificationSummary;
}

// ── Verification Summary ───────────────────────────────────────────────────

export interface VerificationSummary {
  totalFlags: number;
  unresolvedCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  verificationStatus: VerificationStatus;
}

// ── Severity config (for UI rendering) ─────────────────────────────────────

export interface SeverityConfig {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
}

export const SEVERITY_CONFIG: Record<RiskSeverity, SeverityConfig> = {
  critical: {
    icon: "\u26D4",
    color: "text-red-500",
    bgColor: "bg-red-500/15",
    label: "Critical",
  },
  high: {
    icon: "\u26A0",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
    label: "High",
  },
  medium: {
    icon: "\u25CF",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/15",
    label: "Medium",
  },
  low: {
    icon: "\u25CB",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    label: "Low",
  },
  info: {
    icon: "\u2139",
    color: "text-gray-400",
    bgColor: "bg-gray-500/15",
    label: "Info",
  },
};

// ── Category config (for UI rendering) ─────────────────────────────────────

export interface CategoryConfig {
  icon: string;
  label: string;
  description: string;
}

export const CATEGORY_CONFIG: Record<RiskCategory, CategoryConfig> = {
  unsupported_claim: {
    icon: "\u2753",
    label: "Unsupported Claim",
    description: "Factual assertion without matching evidence in sessions or references.",
  },
  outdated_info: {
    icon: "\u231B",
    label: "Outdated Info",
    description: "Information that may no longer be current based on session timestamps.",
  },
  version_specific: {
    icon: "\u{1F4CC}",
    label: "Version-Specific",
    description: "Claim tied to a specific software version that may have changed.",
  },
  subjective_opinion: {
    icon: "\u{1F4AD}",
    label: "Subjective Opinion",
    description: "Statement that reads as opinion rather than verifiable fact.",
  },
  unverified_metric: {
    icon: "\u{1F4CA}",
    label: "Unverified Metric",
    description: "Numeric or performance claim without supporting data.",
  },
};
