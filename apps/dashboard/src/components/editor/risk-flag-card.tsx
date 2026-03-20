"use client";

import { useState } from "react";
import type { RiskFlag } from "@sessionforge/db";
import {
  SEVERITY_CONFIG,
  CATEGORY_CONFIG,
  type RiskSeverity,
  type RiskCategory,
} from "../../lib/verification/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskFlagCardProps {
  flag: RiskFlag;
  isHighlighted?: boolean;
  onResolve?: (flagId: string, status: "verified" | "dismissed", notes?: string) => void;
  onViewEvidence?: (flagId: string) => void;
}

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RiskFlag["status"], string> = {
  unresolved: "Unresolved",
  verified: "Verified",
  dismissed: "Dismissed",
  overridden: "Overridden",
};

// ── Component ──────────────────────────────────────────────────────────────

export function RiskFlagCard({
  flag,
  isHighlighted = false,
  onResolve,
  onViewEvidence,
}: RiskFlagCardProps) {
  const [expanded, setExpanded] = useState(false);

  const severityConfig = SEVERITY_CONFIG[flag.severity as RiskSeverity];
  const categoryConfig = CATEGORY_CONFIG[flag.category as RiskCategory];
  const isResolved = flag.status === "verified" || flag.status === "dismissed" || flag.status === "overridden";

  return (
    <div
      className={`rounded-sf border p-3 transition-colors ${
        isHighlighted
          ? "border-sf-accent bg-sf-accent/5"
          : isResolved
            ? "border-sf-border/50 bg-sf-bg-tertiary/50 opacity-70"
            : "border-sf-border bg-sf-bg-tertiary hover:border-sf-border-focus"
      }`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {/* Severity badge */}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${severityConfig.bgColor} ${severityConfig.color}`}
            >
              <span>{severityConfig.icon}</span>
              <span>{severityConfig.label}</span>
            </span>

            {/* Category badge */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-sf-text-secondary bg-sf-bg-secondary">
              <span>{categoryConfig.icon}</span>
              <span>{categoryConfig.label}</span>
            </span>
          </div>

          {/* Status / expand indicator */}
          <div className="flex items-center gap-1.5">
            {isResolved && (
              <span className="text-[10px] text-sf-text-muted">
                {STATUS_LABELS[flag.status]}
              </span>
            )}
            <span className={`text-xs text-sf-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}>
              ▾
            </span>
          </div>
        </div>

        {/* Flagged sentence */}
        <p className={`text-xs text-sf-text-primary leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
          {flag.sentence}
        </p>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Category description */}
          <p className="text-[10px] text-sf-text-muted leading-relaxed">
            {categoryConfig.description}
          </p>

          {/* Evidence snippets */}
          {flag.evidence.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-sf-text-secondary uppercase tracking-wide">
                Evidence ({flag.evidence.length})
              </p>
              {flag.evidence.map((ev, idx) => (
                <div
                  key={idx}
                  className="rounded bg-sf-bg-secondary border border-sf-border/50 p-2"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-medium text-sf-text-muted uppercase">
                      {ev.type.replace("_", " ")}
                    </span>
                    {ev.sessionId && (
                      <span className="text-[10px] text-sf-text-muted truncate max-w-[120px]">
                        · {ev.sessionId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sf-text-secondary leading-relaxed line-clamp-3">
                    {ev.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {!isResolved && (
            <div className="flex items-center gap-2 pt-1 border-t border-sf-border/50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve?.(flag.id, "verified");
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
              >
                <span>✓</span>
                <span>Mark Verified</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve?.(flag.id, "dismissed");
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-sf-text-muted hover:text-sf-text-secondary bg-sf-bg-secondary hover:bg-sf-bg-secondary/80 transition-colors"
              >
                <span>✕</span>
                <span>Dismiss</span>
              </button>
              {flag.evidence.length > 0 && onViewEvidence && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewEvidence(flag.id);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-sf-accent hover:text-sf-accent/80 transition-colors ml-auto"
                >
                  <span>→</span>
                  <span>View Evidence</span>
                </button>
              )}
            </div>
          )}

          {/* Resolved info */}
          {isResolved && flag.resolvedAt && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-sf-border/50">
              <span className="text-[10px] text-sf-text-muted">
                {STATUS_LABELS[flag.status]} on {new Date(flag.resolvedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
