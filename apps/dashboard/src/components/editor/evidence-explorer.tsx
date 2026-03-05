"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type EvidenceClassification =
  | "confirmation"
  | "contradiction"
  | "discovery"
  | "evolution"
  | "failure"
  | "tool_evaluation";

export interface EvidenceDisplayItem {
  id: string;
  classification: EvidenceClassification;
  sourceType: "session" | "url" | "repo" | "brief";
  label: string;
  timestamp?: string;
  excerpt: string;
  relevanceScore: number;
  projectName?: string;
}

export interface EvidenceExplorerProps {
  postId: string;
  evidence?: EvidenceDisplayItem[];
  highlightedCitation?: string | null;
  onCitationClick?: (id: string) => void;
}

// ── Classification config ──────────────────────────────────────────────────

type SourceType = "all" | "session" | "url" | "repo" | "brief";
type FilterType = EvidenceClassification | "all";

interface ClassificationConfig {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
}

const CLASSIFICATION_CONFIG: Record<EvidenceClassification, ClassificationConfig> = {
  confirmation: {
    icon: "\u2713",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
    label: "Confirmation",
  },
  contradiction: {
    icon: "\u2717",
    color: "text-red-400",
    bgColor: "bg-red-500/15",
    label: "Contradiction",
  },
  discovery: {
    icon: "\u2605",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    label: "Discovery",
  },
  evolution: {
    icon: "\u21BB",
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
    label: "Evolution",
  },
  failure: {
    icon: "\u26A0",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
    label: "Failure",
  },
  tool_evaluation: {
    icon: "\u2699",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/15",
    label: "Tool Evaluation",
  },
};

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmation", label: "Confirmations" },
  { value: "contradiction", label: "Contradictions" },
  { value: "discovery", label: "Discoveries" },
  { value: "evolution", label: "Evolutions" },
  { value: "failure", label: "Failures" },
  { value: "tool_evaluation", label: "Tool Evaluations" },
];

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "session", label: "Sessions" },
  { value: "url", label: "URLs" },
  { value: "repo", label: "Repos" },
  { value: "brief", label: "Briefs" },
];

// ── Evidence card ──────────────────────────────────────────────────────────

interface EvidenceCardProps {
  item: EvidenceDisplayItem;
  isHighlighted: boolean;
  onClick?: () => void;
}

function EvidenceCard({ item, isHighlighted, onClick }: EvidenceCardProps) {
  const config = CLASSIFICATION_CONFIG[item.classification];
  const relevancePercent = Math.round(item.relevanceScore * 100);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-sf border p-3 transition-colors ${
        isHighlighted
          ? "border-sf-accent bg-sf-accent/5"
          : "border-sf-border bg-sf-bg-tertiary hover:border-sf-border-focus"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
        >
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </span>
        {item.timestamp && (
          <span className="text-[10px] text-sf-text-muted">{item.timestamp}</span>
        )}
      </div>

      {/* Label and project */}
      <p className="text-xs font-medium text-sf-text-primary truncate">{item.label}</p>
      {item.projectName && (
        <p className="text-[10px] text-sf-text-secondary mt-0.5">{item.projectName}</p>
      )}

      {/* Excerpt */}
      <p className="text-xs text-sf-text-secondary mt-1.5 line-clamp-3 leading-relaxed">
        {item.excerpt}
      </p>

      {/* Relevance bar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-sf-bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full ${config.bgColor.replace("/15", "/60")}`}
            style={{ width: `${relevancePercent}%` }}
          />
        </div>
        <span className="text-[10px] text-sf-text-muted">{relevancePercent}%</span>
      </div>
    </button>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-3xl mb-3 opacity-40">
          {"\uD83D\uDD0D"}
        </div>
        <p className="text-sm text-sf-text-muted">No evidence collected yet.</p>
        <p className="text-xs text-sf-text-muted mt-1">
          Generate content from the New Content page to collect session evidence.
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function EvidenceExplorer({
  evidence = [],
  highlightedCitation,
  onCitationClick,
}: EvidenceExplorerProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceType>("all");

  if (evidence.length === 0) {
    return <EmptyState />;
  }

  const filtered = evidence.filter((item) => {
    if (filter !== "all" && item.classification !== filter) return false;
    if (sourceFilter !== "all" && item.sourceType !== sourceFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex gap-2 p-3 border-b border-sf-border">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-2 py-1 text-xs text-sf-text-primary"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceType)}
          className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-2 py-1 text-xs text-sf-text-primary"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Evidence list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-sf-text-muted text-center py-4">
            No items match the current filters.
          </p>
        ) : (
          filtered.map((item) => (
            <EvidenceCard
              key={item.id}
              item={item}
              isHighlighted={highlightedCitation === item.id}
              onClick={() => onCitationClick?.(item.id)}
            />
          ))
        )}
      </div>

      {/* Summary */}
      <div className="p-3 border-t border-sf-border text-xs text-sf-text-muted">
        {filtered.length} of {evidence.length} items
      </div>
    </div>
  );
}
