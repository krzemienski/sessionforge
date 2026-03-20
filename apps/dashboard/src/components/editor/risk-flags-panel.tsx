"use client";

import { useState } from "react";
import type { RiskFlag } from "@sessionforge/db";
import {
  SEVERITY_CONFIG,
  type RiskSeverity,
  type FlagStatus,
  type VerificationSummary,
} from "../../lib/verification/types";
import { RiskFlagCard } from "./risk-flag-card";
import { RiskFlagsSummary } from "./risk-flags-summary";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskFlagsPanelProps {
  postId: string;
  flags?: RiskFlag[];
  summary?: VerificationSummary | null;
  isVerifying?: boolean;
  highlightedFlagId?: string | null;
  onRunVerification?: () => void;
  onResolve?: (flagId: string, status: "verified" | "dismissed", notes?: string) => void;
  onViewEvidence?: (flagId: string) => void;
  onFlagClick?: (flagId: string) => void;
}

// ── Filter types ───────────────────────────────────────────────────────────

type SeverityFilter = RiskSeverity | "all";
type StatusFilter = FlagStatus | "all";

const SEVERITY_FILTER_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "unresolved", label: "Unresolved" },
  { value: "verified", label: "Verified" },
  { value: "dismissed", label: "Dismissed" },
  { value: "overridden", label: "Overridden" },
];

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ hasVerified }: { hasVerified: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-3xl mb-3 opacity-40">
          {hasVerified ? "\u2705" : "\uD83D\uDD0D"}
        </div>
        <p className="text-sm text-sf-text-muted">
          {hasVerified
            ? "No risk flags found."
            : "Verification hasn\u2019t been run yet."}
        </p>
        <p className="text-xs text-sf-text-muted mt-1">
          {hasVerified
            ? "All claims in this content appear well-supported."
            : "Run verification to scan content for unsupported claims."}
        </p>
      </div>
    </div>
  );
}

// ── No filter results ──────────────────────────────────────────────────────

function NoFilterResults() {
  return (
    <p className="text-xs text-sf-text-muted text-center py-4">
      No flags match the current filters.
    </p>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function RiskFlagsPanel({
  flags = [],
  summary = null,
  isVerifying = false,
  highlightedFlagId,
  onRunVerification,
  onResolve,
  onViewEvidence,
  onFlagClick,
}: RiskFlagsPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const hasVerified = summary !== null;

  // Show empty state when no flags and not currently verifying
  if (flags.length === 0 && !isVerifying) {
    return (
      <div className="flex flex-col h-full">
        {/* Summary header (always shown) */}
        <div className="p-3 border-b border-sf-border">
          <RiskFlagsSummary
            summary={summary}
            isVerifying={isVerifying}
            onRunVerification={onRunVerification}
          />
        </div>

        <EmptyState hasVerified={hasVerified} />
      </div>
    );
  }

  const filtered = flags.filter((flag) => {
    if (severityFilter !== "all" && flag.severity !== severityFilter) return false;
    if (statusFilter !== "all" && flag.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Summary header */}
      <div className="p-3 border-b border-sf-border">
        <RiskFlagsSummary
          summary={summary}
          isVerifying={isVerifying}
          onRunVerification={onRunVerification}
        />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 p-3 border-b border-sf-border">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
          className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-2 py-1 text-xs text-sf-text-primary"
        >
          {SEVERITY_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-2 py-1 text-xs text-sf-text-primary"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Flag list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <NoFilterResults />
        ) : (
          filtered.map((flag) => (
            <RiskFlagCard
              key={flag.id}
              flag={flag}
              isHighlighted={highlightedFlagId === flag.id}
              onResolve={onResolve}
              onViewEvidence={onViewEvidence}
            />
          ))
        )}
      </div>

      {/* Summary footer */}
      <div className="p-3 border-t border-sf-border text-xs text-sf-text-muted">
        {filtered.length} of {flags.length} flags
      </div>
    </div>
  );
}
