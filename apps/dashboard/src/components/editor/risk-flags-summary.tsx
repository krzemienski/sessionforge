"use client";

import { cn } from "@/lib/utils";
import {
  SEVERITY_CONFIG,
  type VerificationStatus,
  type VerificationSummary,
} from "../../lib/verification/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskFlagsSummaryProps {
  summary: VerificationSummary | null;
  isVerifying?: boolean;
  onRunVerification?: () => void;
}

// ── Status icon & label ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  VerificationStatus,
  { icon: string; color: string; bgColor: string; label: string }
> = {
  unverified: {
    icon: "○",
    color: "text-sf-text-muted",
    bgColor: "bg-sf-bg-tertiary",
    label: "Not Verified",
  },
  pending: {
    icon: "◌",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/15",
    label: "Pending",
  },
  verified: {
    icon: "✓",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
    label: "Verified",
  },
  has_issues: {
    icon: "⚠",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
    label: "Has Issues",
  },
};

// ── Severity counts builder ────────────────────────────────────────────────

function buildSeverityCounts(summary: VerificationSummary): string {
  const parts: string[] = [];

  if (summary.criticalCount > 0)
    parts.push(`${summary.criticalCount} critical`);
  if (summary.highCount > 0)
    parts.push(`${summary.highCount} high`);
  if (summary.mediumCount > 0)
    parts.push(`${summary.mediumCount} medium`);
  if (summary.lowCount > 0)
    parts.push(`${summary.lowCount} low`);
  if (summary.infoCount > 0)
    parts.push(`${summary.infoCount} info`);

  return parts.length > 0 ? parts.join(", ") : "No issues found";
}

// ── Severity dots ──────────────────────────────────────────────────────────

function SeverityDots({ summary }: { summary: VerificationSummary }) {
  const severities = [
    { count: summary.criticalCount, severity: "critical" as const },
    { count: summary.highCount, severity: "high" as const },
    { count: summary.mediumCount, severity: "medium" as const },
    { count: summary.lowCount, severity: "low" as const },
    { count: summary.infoCount, severity: "info" as const },
  ].filter((s) => s.count > 0);

  if (severities.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {severities.map(({ count, severity }) => {
        const config = SEVERITY_CONFIG[severity];
        return (
          <span
            key={severity}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
              config.bgColor,
              config.color
            )}
          >
            <span>{config.icon}</span>
            <span>{count}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sf-text-muted border-t-sf-accent" />
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function RiskFlagsSummary({
  summary,
  isVerifying = false,
  onRunVerification,
}: RiskFlagsSummaryProps) {
  const status = summary?.verificationStatus ?? "unverified";
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: status icon + counts */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Verification status badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0",
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {isVerifying ? <Spinner /> : <span>{statusConfig.icon}</span>}
            <span>{isVerifying ? "Verifying…" : statusConfig.label}</span>
          </span>

          {/* Severity counts */}
          {summary && !isVerifying && (
            <>
              <span className="text-sf-border">·</span>
              {summary.totalFlags > 0 ? (
                <SeverityDots summary={summary} />
              ) : (
                <span className="text-xs text-sf-text-muted">
                  No issues found
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: Run Verification button */}
        <button
          onClick={onRunVerification}
          disabled={isVerifying}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-sf text-xs font-medium transition-colors shrink-0",
            isVerifying
              ? "bg-sf-bg-tertiary text-sf-text-muted cursor-not-allowed"
              : "bg-sf-accent/15 text-sf-accent hover:bg-sf-accent/25"
          )}
        >
          {isVerifying ? (
            <>
              <Spinner />
              <span>Verifying…</span>
            </>
          ) : (
            <>
              <span>⟳</span>
              <span>{summary ? "Re-verify" : "Run Verification"}</span>
            </>
          )}
        </button>
      </div>

      {/* Summary text below */}
      {summary && !isVerifying && summary.totalFlags > 0 && (
        <p className="text-[10px] text-sf-text-muted mt-2 leading-relaxed">
          {buildSeverityCounts(summary)} · {summary.unresolvedCount} unresolved of{" "}
          {summary.totalFlags} total
        </p>
      )}
    </div>
  );
}
