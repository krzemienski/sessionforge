"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useInsights } from "@/hooks/use-insights";
import { useFilterParams } from "@/hooks/use-filter-params";
import { useState } from "react";
import { Lightbulb, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  novel_problem_solving: { label: "Novel", color: "text-purple-400 bg-purple-400/10" },
  tool_pattern_discovery: { label: "Tool Pattern", color: "text-blue-400 bg-blue-400/10" },
  before_after_transformation: { label: "Transform", color: "text-green-400 bg-green-400/10" },
  failure_recovery: { label: "Recovery", color: "text-red-400 bg-red-400/10" },
  architecture_decision: { label: "Architecture", color: "text-yellow-400 bg-yellow-400/10" },
  performance_optimization: { label: "Performance", color: "text-cyan-400 bg-cyan-400/10" },
};

const FILTER_DEFAULTS = {
  category: "",
  minScore: "",
  sessionId: "",
  dateFrom: "",
  dateTo: "",
};

export default function InsightsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilter, resetFilters] = useFilterParams(FILTER_DEFAULTS);

  const insights = useInsights(workspace, {
    limit: 50,
    category: filters.category || undefined,
    minScore: filters.minScore ? Number(filters.minScore) : undefined,
    sessionId: filters.sessionId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  const insightList = insights.data?.insights ?? [];

  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Insights</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "relative flex items-center gap-2 border px-4 py-2 rounded-sf font-medium text-sm transition-colors",
            showFilters
              ? "bg-sf-accent-bg border-sf-accent text-sf-accent"
              : "bg-sf-bg-secondary border-sf-border text-sf-text-primary hover:bg-sf-bg-hover"
          )}
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-sf-accent text-sf-bg-primary text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sf-text-primary text-sm">Filters</h3>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-sf-text-muted hover:text-sf-text-secondary"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setShowFilters(false)}
                className="text-sf-text-muted hover:text-sf-text-secondary"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-sf-text-muted mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setFilter("category", filters.category === key ? "" : key)}
                  className={cn(
                    "px-3 py-1 rounded-sf-full text-xs font-medium transition-colors border",
                    filters.category === key
                      ? cn(cat.color, "border-current")
                      : "text-sf-text-secondary bg-sf-bg-tertiary border-sf-border hover:bg-sf-bg-hover"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="text-sm text-sf-text-secondary whitespace-nowrap">Min Score:</label>
            <input
              type="range"
              min={0}
              max={65}
              value={filters.minScore || "0"}
              onChange={(e) => setFilter("minScore", e.target.value === "0" ? "" : e.target.value)}
              className="accent-sf-accent flex-1"
            />
            <span className="text-sm text-sf-text-primary font-display w-8">
              {filters.minScore || 0}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilter("dateFrom", e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilter("dateTo", e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-sf-text-muted mb-1">Session ID</label>
            <input
              type="text"
              placeholder="Filter by session ID..."
              value={filters.sessionId}
              onChange={(e) => setFilter("sessionId", e.target.value)}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {insightList.map((ins: any) => {
          const cat = CATEGORIES[ins.category] ?? { label: ins.category, color: "text-sf-text-secondary bg-sf-bg-tertiary" };
          return (
            <div
              key={ins.id}
              onClick={() => router.push(`/${workspace}/insights/${ins.id}`)}
              className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("px-2 py-0.5 rounded-sf-full text-xs font-medium", cat.color)}>{cat.label}</span>
                <span className="ml-auto px-3 py-0.5 bg-sf-accent-bg text-sf-accent rounded-sf-full text-sm font-bold font-display">
                  {ins.compositeScore?.toFixed(0) ?? 0}/65
                </span>
              </div>
              <h3 className="font-semibold text-sf-text-primary mb-1">{ins.title}</h3>
              <p className="text-sm text-sf-text-secondary line-clamp-2">{ins.description}</p>
              <div className="flex gap-1 mt-3">
                {[
                  { score: ins.noveltyScore, w: 3 },
                  { score: ins.toolPatternScore, w: 3 },
                  { score: ins.transformationScore, w: 2 },
                  { score: ins.failureRecoveryScore, w: 3 },
                  { score: ins.reproducibilityScore, w: 1 },
                  { score: ins.scaleScore, w: 1 },
                ].map((d, i) => (
                  <div key={i} className="h-2 flex-1 bg-sf-bg-tertiary rounded-full overflow-hidden">
                    <div className="h-full bg-sf-accent rounded-full" style={{ width: `${((d.score || 0) / 5) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {insightList.length === 0 && !insights.isLoading && (
          <div className="text-center py-12">
            <Lightbulb size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-primary font-medium mb-1">No insights yet</p>
            <p className="text-sf-text-secondary mb-6 text-sm">Extract insights from your sessions to surface patterns, decisions, and discoveries.</p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href={`/${workspace}/sessions`}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
              >
                View Sessions →
              </Link>
              <Link
                href="/onboarding"
                className="text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                View setup guide →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
