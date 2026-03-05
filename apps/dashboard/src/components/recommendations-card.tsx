"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, TrendingUp, FileText, AlignLeft, Tag, Wrench, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationType = "topic" | "format" | "length" | "keyword" | "improvement";

export interface Recommendation {
  id: string;
  recommendationType: RecommendationType;
  title: string;
  description: string;
  reasoning: string;
  supportingData?: Record<string, unknown> | null;
  confidenceScore: number;
  helpfulRating?: boolean | null;
  createdAt?: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onRate?: (id: string, helpful: boolean) => Promise<void>;
}

const TYPE_CONFIG: Record<RecommendationType, { label: string; color: string; icon: React.ReactNode }> = {
  topic: {
    label: "Topic",
    color: "text-purple-400 bg-purple-400/10",
    icon: <TrendingUp size={14} />,
  },
  format: {
    label: "Format",
    color: "text-blue-400 bg-blue-400/10",
    icon: <FileText size={14} />,
  },
  length: {
    label: "Length",
    color: "text-green-400 bg-green-400/10",
    icon: <AlignLeft size={14} />,
  },
  keyword: {
    label: "Keyword",
    color: "text-yellow-400 bg-yellow-400/10",
    icon: <Tag size={14} />,
  },
  improvement: {
    label: "Improvement",
    color: "text-red-400 bg-red-400/10",
    icon: <Wrench size={14} />,
  },
};

function SupportingDataView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider mb-2">
        Supporting Data
      </p>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([key, value]) => {
          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const display =
            typeof value === "number"
              ? Number.isInteger(value)
                ? value.toLocaleString()
                : (value as number).toFixed(2)
              : Array.isArray(value)
              ? (value as unknown[]).slice(0, 3).join(", ") + (value.length > 3 ? "…" : "")
              : String(value);

          return (
            <div key={key} className="bg-sf-bg-tertiary rounded-sf px-2.5 py-1.5">
              <p className="text-xs text-sf-text-muted leading-none mb-0.5">{label}</p>
              <p className="text-sm font-medium text-sf-text-primary truncate">{display}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RecommendationCard({ recommendation, onRate }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState<boolean | null>(recommendation.helpfulRating ?? null);
  const [isRating, setIsRating] = useState(false);

  const config = TYPE_CONFIG[recommendation.recommendationType];

  async function handleRate(helpful: boolean) {
    if (isRating || rating !== null) return;
    setIsRating(true);
    try {
      await onRate?.(recommendation.id, helpful);
      setRating(helpful);
    } finally {
      setIsRating(false);
    }
  }

  return (
    <div className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 transition-colors">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-sf-full text-xs font-medium",
            config.color
          )}
        >
          {config.icon}
          {config.label}
        </span>
        <span className="ml-auto px-3 py-0.5 bg-sf-accent-bg text-sf-accent rounded-sf-full text-sm font-bold font-display">
          {Math.round(recommendation.confidenceScore * 100)}%
        </span>
      </div>

      {/* Title & description */}
      <h3 className="font-semibold text-sf-text-primary mb-1">{recommendation.title}</h3>
      <p className="text-sm text-sf-text-secondary">{recommendation.description}</p>

      {/* Reasoning + supporting data (expandable) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 mt-3 text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors"
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? "Hide reasoning" : "Show reasoning"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-3">
          <div className="text-sm text-sf-text-secondary bg-sf-bg-tertiary rounded-sf p-3">
            <p className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider mb-1">
              Reasoning
            </p>
            {recommendation.reasoning}
          </div>
          {recommendation.supportingData && Object.keys(recommendation.supportingData).length > 0 && (
            <SupportingDataView data={recommendation.supportingData as Record<string, unknown>} />
          )}
        </div>
      )}

      {/* Rating buttons */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-sf-border">
        <span className="text-xs text-sf-text-muted mr-1">Was this helpful?</span>
        <button
          onClick={() => handleRate(true)}
          disabled={isRating || rating !== null}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-sf text-xs font-medium transition-colors",
            rating === true
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : rating === false
              ? "text-sf-text-muted opacity-40 cursor-not-allowed"
              : "bg-sf-bg-tertiary text-sf-text-secondary hover:bg-green-500/10 hover:text-green-400 border border-sf-border"
          )}
        >
          <ThumbsUp size={12} />
          Helpful
        </button>
        <button
          onClick={() => handleRate(false)}
          disabled={isRating || rating !== null}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-sf text-xs font-medium transition-colors",
            rating === false
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : rating === true
              ? "text-sf-text-muted opacity-40 cursor-not-allowed"
              : "bg-sf-bg-tertiary text-sf-text-secondary hover:bg-red-500/10 hover:text-red-400 border border-sf-border"
          )}
        >
          <ThumbsDown size={12} />
          Not helpful
        </button>
      </div>
    </div>
  );
}
