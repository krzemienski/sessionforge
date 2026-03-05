"use client";

import { useEffect, useState } from "react";
import { Zap, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GeoCheckId =
  | "heading-structure"
  | "factual-density"
  | "citation-formatting"
  | "scannable-sections";

interface GeoCheckItem {
  id: GeoCheckId | string;
  label: string;
  passed: boolean;
  suggestion?: string;
}

interface SeoData {
  geoScore: number | null;
  geoChecklist: GeoCheckItem[] | null;
}

interface GeoChecklistProps {
  postId: string;
}

// ---------------------------------------------------------------------------
// Static criterion metadata (tooltips / descriptions)
// ---------------------------------------------------------------------------

const CRITERION_META: Record<
  string,
  { description: string; whyItMatters: string }
> = {
  "heading-structure": {
    description:
      "Content uses a logical H1–H6 heading hierarchy with no skipped levels.",
    whyItMatters:
      "AI search engines (Perplexity, ChatGPT Search, Google AI Overviews) parse heading structure to understand topic hierarchy and generate cited summaries.",
  },
  "factual-density": {
    description:
      "Content includes at least 1.5 numeric facts per 100 words — statistics, percentages, measurements, or currency figures.",
    whyItMatters:
      "AI engines prefer citable, verifiable data. High factual density increases the likelihood your content is selected as a source.",
  },
  "citation-formatting": {
    description:
      "Content links to at least 2 authoritative external sources using Markdown link syntax or numeric references.",
    whyItMatters:
      "Perplexity and other AI engines favour content that demonstrates credibility through citations, boosting its citation rank.",
  },
  "scannable-sections": {
    description:
      "Content uses bullet or numbered lists and keeps average paragraph length under 80 words.",
    whyItMatters:
      "Short, scannable sections are easier for AI to extract and reformat into structured answers and featured snippets.",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-3 rounded bg-sf-bg-tertiary animate-pulse", className)}
    />
  );
}

function GeoScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="text-xs text-sf-text-muted">Not analysed yet</span>
    );
  }

  const normalised = score > 1 ? score : Math.round(score * 100);
  const color =
    normalised >= 80
      ? "text-green-500"
      : normalised >= 50
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <span className={cn("text-lg font-bold tabular-nums", color)}>
      {normalised}
      <span className="text-xs font-normal text-sf-text-muted ml-0.5">/ 100</span>
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;

  const normalised = score > 1 ? score : Math.round(score * 100);
  const color =
    normalised >= 80
      ? "bg-green-500"
      : normalised >= 50
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="w-full h-1.5 rounded-full bg-sf-bg-tertiary overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.min(normalised, 100)}%` }}
      />
    </div>
  );
}

function CriterionTooltip({
  checkId,
  visible,
}: {
  checkId: string;
  visible: boolean;
}) {
  const meta = CRITERION_META[checkId];
  if (!meta || !visible) return null;

  return (
    <div className="mt-2 p-2.5 rounded border border-sf-border bg-sf-bg-primary space-y-1.5 text-xs">
      <p className="text-sf-text-secondary leading-relaxed">{meta.description}</p>
      <div className="flex items-start gap-1.5 pt-1 border-t border-sf-border">
        <Zap size={10} className="text-sf-accent flex-shrink-0 mt-0.5" />
        <p className="text-sf-text-muted leading-relaxed">{meta.whyItMatters}</p>
      </div>
    </div>
  );
}

function ChecklistItem({ item }: { item: GeoCheckItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta = item.id in CRITERION_META;
  const hasSuggestion = !!item.suggestion;

  return (
    <div className="rounded border border-sf-border bg-sf-bg-tertiary overflow-hidden">
      {/* Main row */}
      <div
        className={cn(
          "flex items-start gap-2.5 p-3",
          (hasMeta || hasSuggestion) && "cursor-pointer select-none"
        )}
        onClick={() => {
          if (hasMeta || hasSuggestion) setExpanded((v) => !v);
        }}
        role={hasMeta || hasSuggestion ? "button" : undefined}
        aria-expanded={hasMeta || hasSuggestion ? expanded : undefined}
      >
        {/* Pass/fail icon */}
        {item.passed ? (
          <CheckCircle2
            size={15}
            className="flex-shrink-0 mt-0.5 text-green-500"
            aria-label="Passed"
          />
        ) : (
          <XCircle
            size={15}
            className="flex-shrink-0 mt-0.5 text-red-500"
            aria-label="Failed"
          />
        )}

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-xs font-medium",
              item.passed ? "text-sf-text-secondary" : "text-sf-text-primary"
            )}
          >
            {item.label}
          </p>

          {/* Inline pass / fail badge */}
          <span
            className={cn(
              "inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 font-medium",
              item.passed
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500"
            )}
          >
            {item.passed ? "Passed" : "Needs improvement"}
          </span>
        </div>

        {/* Expand / info toggle */}
        {hasMeta || hasSuggestion ? (
          <div className="flex-shrink-0 text-sf-text-muted mt-0.5">
            {expanded ? (
              <ChevronUp size={13} />
            ) : (
              <div className="flex items-center gap-0.5">
                <Info size={11} />
                <ChevronDown size={13} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Suggestion from analysis */}
          {hasSuggestion && !item.passed && (
            <div className="flex items-start gap-1.5 p-2 rounded bg-red-500/5 border border-red-500/20 text-xs text-red-400">
              <XCircle size={11} className="flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{item.suggestion}</p>
            </div>
          )}

          {/* Tooltip: criterion description + why it matters */}
          <CriterionTooltip checkId={item.id} visible />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="h-8 w-8 rounded-full bg-sf-bg-tertiary flex items-center justify-center">
        <Zap size={15} className="text-sf-text-muted" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-sf-text-secondary">
          GEO analysis not run yet
        </p>
        <p className="text-xs text-sf-text-muted max-w-[220px] leading-relaxed">
          Run SEO analysis to evaluate your content for AI search engines like
          Perplexity, ChatGPT Search, and Google AI Overviews.
        </p>
      </div>
    </div>
  );
}

function PassFailSummary({
  checklist,
}: {
  checklist: GeoCheckItem[];
}) {
  const passed = checklist.filter((c) => c.passed).length;
  const total = checklist.length;
  const allPassed = passed === total;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded border text-xs font-medium",
        allPassed
          ? "bg-green-500/5 border-green-500/20 text-green-500"
          : passed >= total / 2
          ? "bg-yellow-500/5 border-yellow-500/20 text-yellow-500"
          : "bg-red-500/5 border-red-500/20 text-red-400"
      )}
    >
      <span>
        {passed} / {total} checks passed
      </span>
      {allPassed && (
        <span className="flex items-center gap-1">
          <CheckCircle2 size={11} />
          All criteria met
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function GeoChecklist({ postId }: GeoChecklistProps) {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/content/${postId}/seo`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<SeoData>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-full h-1.5" />
        <SkeletonLine className="w-32" />
        {[0, 1, 2, 3].map((i) => (
          <SkeletonLine key={i} className="w-full h-12" />
        ))}
      </div>
    );
  }

  const checklist = data?.geoChecklist ?? null;
  const geoScore = data?.geoScore ?? null;

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={13} className="text-sf-text-muted flex-shrink-0" />
          <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
            GEO Checklist
          </h3>
        </div>
        <GeoScoreBadge score={geoScore} />
      </div>

      {/* Score bar */}
      {geoScore !== null && <ScoreBar score={geoScore} />}

      {/* No data state */}
      {!checklist || checklist.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Pass / fail summary */}
          <PassFailSummary checklist={checklist} />

          {/* Individual check items */}
          <div className="space-y-2">
            {checklist.map((item) => (
              <ChecklistItem key={item.id} item={item} />
            ))}
          </div>

          {/* What is GEO callout */}
          <div className="flex items-start gap-2 p-2.5 rounded bg-sf-bg-tertiary border border-sf-border text-xs text-sf-text-muted">
            <Info size={11} className="flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              GEO (Generative Engine Optimization) helps your content rank in
              AI-powered search engines. Click any criterion to learn more.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
