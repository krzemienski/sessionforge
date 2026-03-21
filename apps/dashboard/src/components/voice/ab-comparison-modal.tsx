"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw, GitCompare, FileText, Sparkles } from "lucide-react";
import { computeEditDistance } from "@/lib/style/edit-distance";

// --- Types ---

interface ABComparisonResult {
  withVoice: string;
  withoutVoice: string;
}

interface ABComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  insightId?: string;
  contentType?: string;
}

// --- Helpers ---

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getImpactLabel(similarity: number): { label: string; color: string } {
  const diff = 1 - similarity;
  if (diff >= 0.4) return { label: "Major impact", color: "#10b981" };
  if (diff >= 0.2) return { label: "Significant impact", color: "#3b82f6" };
  if (diff >= 0.1) return { label: "Moderate impact", color: "#f59e0b" };
  return { label: "Subtle impact", color: "#94a3b8" };
}

// --- Sub-components ---

function ContentPanel({
  title,
  badge,
  badgeColor,
  content,
  wordCount,
  icon,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  content: string;
  wordCount: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-w-0 bg-sf-bg-tertiary border border-sf-border rounded-sf-lg overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sf-border bg-sf-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-sf-text-secondary">{icon}</span>
          <span className="text-sm font-semibold text-sf-text-primary">{title}</span>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full border"
          style={{ color: badgeColor, borderColor: `${badgeColor}40`, backgroundColor: `${badgeColor}15` }}
        >
          {badge}
        </span>
      </div>
      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto max-h-80">
        <p className="text-sm text-sf-text-primary leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
      {/* Footer */}
      <div className="px-4 py-2 border-t border-sf-border">
        <span className="text-xs text-sf-text-secondary">{wordCount} words</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <RefreshCw size={28} className="text-sf-accent animate-spin" />
      <div className="text-center">
        <p className="text-sm font-medium text-sf-text-primary">Generating comparison…</p>
        <p className="text-xs text-sf-text-secondary mt-1">
          Creating two versions of the content to compare
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onGenerate, isPending }: { onGenerate: () => void; isPending: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-12 h-12 rounded-sf-full bg-sf-accent-bg border border-sf-accent/30 flex items-center justify-center">
        <GitCompare size={24} className="text-sf-accent" />
      </div>
      <div>
        <p className="text-sm font-semibold text-sf-text-primary">See your voice in action</p>
        <p className="text-xs text-sf-text-secondary mt-1 max-w-xs">
          Generate two versions of sample content — one with your voice profile applied, one without
          — to see how your calibrated style changes the output.
        </p>
      </div>
      <button
        onClick={onGenerate}
        disabled={isPending}
        className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
      >
        <Sparkles size={14} />
        Generate Comparison
      </button>
    </div>
  );
}

// --- Main component ---

export function ABComparisonModal({
  isOpen,
  onClose,
  workspaceSlug,
  insightId,
  contentType,
}: ABComparisonModalProps) {
  const [result, setResult] = useState<ABComparisonResult | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleGenerate() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/agents/ab-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, insightId, contentType }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? `Request failed (${response.status})`);
      }

      const data: ABComparisonResult = await response.json();
      setResult(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsPending(false);
    }
  }

  const similarity = result
    ? computeEditDistance(result.withoutVoice, result.withVoice)
    : null;

  const differencePercent =
    similarity !== null ? Math.round((1 - similarity) * 100) : null;

  const impact = similarity !== null ? getImpactLabel(similarity) : null;

  const withVoiceWords = result ? countWords(result.withVoice) : 0;
  const withoutVoiceWords = result ? countWords(result.withoutVoice) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-3xl bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sf-border shrink-0">
          <div className="flex items-center gap-3">
            <GitCompare size={18} className="text-sf-accent" />
            <div>
              <h2 className="text-base font-semibold font-display text-sf-text-primary">
                Voice Comparison
              </h2>
              <p className="text-xs text-sf-text-secondary">
                Side-by-side view of your calibrated voice vs. generic output
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {isPending ? (
            <LoadingState />
          ) : result ? (
            <div className="space-y-4">
              {/* Impact summary */}
              {differencePercent !== null && impact && (
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-sf border"
                  style={{
                    borderColor: `${impact.color}40`,
                    backgroundColor: `${impact.color}10`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} style={{ color: impact.color }} />
                    <span className="text-sm font-medium" style={{ color: impact.color }}>
                      {impact.label}
                    </span>
                  </div>
                  <span className="text-sm text-sf-text-secondary">
                    Voice makes{" "}
                    <span className="font-semibold" style={{ color: impact.color }}>
                      {differencePercent}%
                    </span>{" "}
                    difference
                  </span>
                </div>
              )}

              {/* Side-by-side panels */}
              <div className="flex gap-4">
                <ContentPanel
                  title="Without Voice"
                  badge="Generic"
                  badgeColor="#94a3b8"
                  content={result.withoutVoice}
                  wordCount={withoutVoiceWords}
                  icon={<FileText size={14} />}
                />
                <ContentPanel
                  title="With Your Voice"
                  badge="Calibrated"
                  badgeColor="#10b981"
                  content={result.withVoice}
                  wordCount={withVoiceWords}
                  icon={<Sparkles size={14} />}
                />
              </div>
            </div>
          ) : (
            <EmptyState onGenerate={handleGenerate} isPending={isPending} />
          )}

          {/* Error */}
          {errorMessage && (
            <p className="mt-4 text-sm text-sf-error text-center">{errorMessage}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-sf-border shrink-0">
          {result ? (
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="flex items-center gap-2 text-sm text-sf-text-secondary hover:text-sf-text-primary border border-sf-border hover:border-sf-border-focus px-3 py-1.5 rounded-sf transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isPending ? "animate-spin" : ""} />
              Regenerate
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sf text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Trigger button ---

export function CompareVoiceButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-1.5 rounded-sf text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary border border-sf-border hover:border-sf-border-focus bg-sf-bg-secondary hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
    >
      <GitCompare size={14} />
      Compare Voice
    </button>
  );
}
