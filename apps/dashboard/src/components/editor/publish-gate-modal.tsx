"use client";

import { useState } from "react";
import { X, ShieldAlert, ArrowRight, AlertTriangle } from "lucide-react";
import type { RiskFlag } from "@sessionforge/db";
import {
  SEVERITY_CONFIG,
  CATEGORY_CONFIG,
  type RiskSeverity,
  type RiskCategory,
} from "../../lib/verification/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PublishGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Unresolved critical risk flags that block publishing. */
  blockingFlags: RiskFlag[];
  /** Whether the current user has owner/editor role and can override. */
  canOverride: boolean;
  /** Called when user clicks "Resolve Flags" — navigate to risk flags panel. */
  onResolveFlags: () => void;
  /** Called when user confirms override and publishes anyway. */
  onOverridePublish: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function PublishGateModal({
  isOpen,
  onClose,
  blockingFlags,
  canOverride,
  onResolveFlags,
  onOverridePublish,
}: PublishGateModalProps) {
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);

  if (!isOpen) return null;

  function handleClose() {
    setOverrideConfirmed(false);
    onClose();
  }

  function handleResolveFlags() {
    setOverrideConfirmed(false);
    onResolveFlags();
  }

  function handleOverridePublish() {
    if (!overrideConfirmed) return;
    setOverrideConfirmed(false);
    onOverridePublish();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sf-border">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-sf-danger shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-sf-text-primary">
                Publishing Blocked
              </h2>
              <p className="text-xs text-sf-text-muted mt-0.5">
                {blockingFlags.length} unresolved critical risk{" "}
                {blockingFlags.length === 1 ? "flag" : "flags"} must be
                addressed before publishing.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-sf-text-muted hover:text-sf-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Explanation */}
          <div className="flex items-start gap-2 bg-sf-danger/10 border border-sf-danger/30 rounded-sf p-3">
            <AlertTriangle
              size={16}
              className="text-sf-danger mt-0.5 shrink-0"
            />
            <p className="text-sm text-sf-text-secondary">
              This content contains factual claims that could not be verified
              against your session data or linked references. Publishing with
              unresolved critical flags may result in inaccurate content.
            </p>
          </div>

          {/* Blocking flags list */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide">
              Blocking Flags ({blockingFlags.length})
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {blockingFlags.map((flag) => {
                const severityConfig =
                  SEVERITY_CONFIG[flag.severity as RiskSeverity];
                const categoryConfig =
                  CATEGORY_CONFIG[flag.category as RiskCategory];
                return (
                  <div
                    key={flag.id}
                    className="rounded-sf border border-sf-border bg-sf-bg-tertiary p-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${severityConfig.bgColor} ${severityConfig.color}`}
                      >
                        <span>{severityConfig.icon}</span>
                        <span>{severityConfig.label}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-sf-text-secondary bg-sf-bg-secondary">
                        <span>{categoryConfig.icon}</span>
                        <span>{categoryConfig.label}</span>
                      </span>
                    </div>
                    <p className="text-xs text-sf-text-primary leading-relaxed line-clamp-2">
                      {flag.sentence}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-1">
            {/* Primary: resolve flags */}
            <button
              onClick={handleResolveFlags}
              className="w-full flex items-center justify-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
            >
              <ArrowRight size={15} />
              Resolve Flags
            </button>

            {/* Override option — only for owner/editor roles */}
            {canOverride && (
              <div className="border-t border-sf-border pt-3 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideConfirmed}
                    onChange={(e) => setOverrideConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-sf-border bg-sf-bg-tertiary accent-sf-accent"
                  />
                  <span className="text-xs text-sf-text-muted leading-relaxed">
                    I acknowledge these flags and accept responsibility for
                    publishing content with unverified claims.
                  </span>
                </label>
                <button
                  onClick={handleOverridePublish}
                  disabled={!overrideConfirmed}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-sf text-sm font-medium border border-sf-danger/30 text-sf-danger hover:bg-sf-danger/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <AlertTriangle size={15} />
                  Override &amp; Publish Anyway
                </button>
              </div>
            )}

            {/* Cancel */}
            <button
              onClick={handleClose}
              className="w-full text-sm text-sf-text-muted hover:text-sf-text-primary transition-colors py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
