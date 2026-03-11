"use client";

import { AlertTriangle, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIPattern {
  phrase: string;
  category: "hedge" | "filler" | "corporate" | "ai-signature";
  hitCount: number;
  suggestedAlternative: string;
}

interface AIPatternPanelProps {
  patterns: AIPattern[];
  className?: string;
}

function getCategoryColor(category: AIPattern["category"]): string {
  switch (category) {
    case "hedge":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "filler":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "corporate":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "ai-signature":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-sf-bg-tertiary text-sf-text-secondary border-sf-border";
  }
}

function CategoryBadge({ category }: { category: AIPattern["category"] }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-sf text-xs font-medium border",
        getCategoryColor(category)
      )}
    >
      {category}
    </span>
  );
}

function PatternRow({ pattern, rank }: { pattern: AIPattern; rank: number }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-sf-border last:border-0">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-sf-bg-tertiary flex items-center justify-center">
        <span className="text-xs font-bold text-sf-text-secondary">
          {rank}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sf-text-primary text-sm">
            "{pattern.phrase}"
          </span>
          <CategoryBadge category={pattern.category} />
        </div>
        <div className="flex items-center gap-3 text-xs text-sf-text-secondary">
          <span>
            <span className="font-bold text-sf-text-primary">
              {pattern.hitCount}
            </span>{" "}
            {pattern.hitCount === 1 ? "hit" : "hits"}
          </span>
          <span className="text-sf-text-muted">•</span>
          <span>
            Try: <span className="italic text-sf-text-primary">{pattern.suggestedAlternative}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function AIPatternPanel({ patterns, className }: AIPatternPanelProps) {
  const displayPatterns = patterns.slice(0, 10);
  const isEmpty = displayPatterns.length === 0;

  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Brain size={16} className="text-sf-text-secondary" />
        <h3 className="font-semibold text-sf-text-primary font-display text-sm">
          AI Pattern Detection
        </h3>
      </div>

      <div className="mb-4 bg-sf-bg-tertiary border border-sf-border rounded-sf p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-sf-text-secondary leading-relaxed">
            These phrases appear frequently in AI-generated content. Replacing them with your own phrasing strengthens your authentic voice and reduces generic patterns.
          </p>
        </div>
      </div>

      <div>
        {isEmpty ? (
          <div className="py-8 text-center">
            <p className="text-sm text-sf-text-secondary">
              No AI patterns detected in your content.
            </p>
            <p className="text-xs text-sf-text-muted mt-1">
              Great job maintaining an authentic voice!
            </p>
          </div>
        ) : (
          displayPatterns.map((pattern, index) => (
            <PatternRow key={pattern.phrase} pattern={pattern} rank={index + 1} />
          ))
        )}
      </div>
    </div>
  );
}
