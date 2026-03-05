"use client";

import { useState } from "react";
import { Sparkles, Clock, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationStatus = "pending" | "accepted" | "dismissed";

export interface Recommendation {
  id: string;
  title: string;
  reasoning: string;
  suggestedPublishTime?: string;
  contentType?: string;
  insightScore?: number;
  priority: RecommendationPriority;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
  className?: string;
}

const PRIORITY_STYLES: Record<RecommendationPriority, string> = {
  high: "text-green-400 bg-green-400/10 border-green-400/20",
  medium: "text-sf-accent bg-sf-accent/10 border-sf-accent/20",
  low: "text-sf-text-muted bg-sf-bg-tertiary border-sf-border",
};

const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  high: "High Priority",
  medium: "Suggested",
  low: "Optional",
};

function formatPublishTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function RecommendationCard({
  recommendation,
  onAccept,
  onDismiss,
  className,
}: RecommendationCardProps) {
  const [status, setStatus] = useState<RecommendationStatus>("pending");
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  const { id, title, reasoning, suggestedPublishTime, contentType, insightScore, priority } =
    recommendation;

  function handleAccept() {
    setStatus("accepted");
    onAccept?.(id);
  }

  function handleDismiss() {
    setStatus("dismissed");
    onDismiss?.(id);
  }

  if (status === "dismissed") return null;

  return (
    <div
      className={cn(
        "border rounded-sf bg-sf-bg-secondary p-4 space-y-3 transition-opacity",
        status === "accepted" ? "border-green-400/30 opacity-75" : "border-sf-border",
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles
            size={14}
            className="text-sf-accent flex-shrink-0 mt-0.5"
          />
          <p className="text-sm font-medium text-sf-text-primary leading-snug">{title}</p>
        </div>
        <span
          className={cn(
            "flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded border",
            PRIORITY_STYLES[priority]
          )}
        >
          {PRIORITY_LABELS[priority]}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3">
        {suggestedPublishTime && (
          <span className="flex items-center gap-1.5 text-xs text-sf-text-secondary">
            <Clock size={12} className="text-sf-text-muted flex-shrink-0" />
            {formatPublishTime(suggestedPublishTime)}
          </span>
        )}
        {contentType && (
          <span className="font-code text-xs px-1.5 py-0.5 rounded bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary">
            {contentType}
          </span>
        )}
        {insightScore !== undefined && (
          <span className="text-xs text-sf-text-muted">
            Score:{" "}
            <span className="text-sf-accent font-semibold">{insightScore}</span>
          </span>
        )}
      </div>

      {/* Reasoning toggle */}
      <button
        type="button"
        onClick={() => setReasoningExpanded((prev) => !prev)}
        className="flex items-center gap-1 text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors"
      >
        {reasoningExpanded ? (
          <>
            <ChevronUp size={12} />
            Hide reasoning
          </>
        ) : (
          <>
            <ChevronDown size={12} />
            Why this recommendation?
          </>
        )}
      </button>

      {reasoningExpanded && (
        <p className="text-xs text-sf-text-secondary leading-relaxed pl-1 border-l-2 border-sf-border">
          {reasoning}
        </p>
      )}

      {/* Action buttons */}
      {status === "pending" ? (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleAccept}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-sf-accent/10 border border-sf-accent/30 text-sf-accent hover:bg-sf-accent/20 transition-colors"
          >
            <Check size={12} />
            Accept
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-sf-bg-tertiary border border-sf-border text-sf-text-muted hover:text-sf-text-secondary hover:border-sf-text-muted transition-colors"
          >
            <X size={12} />
            Dismiss
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-green-400">
          <Check size={12} />
          Accepted — draft post created in your calendar
        </p>
      )}
    </div>
  );
}
