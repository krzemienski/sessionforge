"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useInsights } from "@/hooks/use-insights";
import { useFilterParams } from "@/hooks/use-filter-params";
import { useState, useCallback, useEffect } from "react";
import { Lightbulb, SlidersHorizontal, X, Sparkles, ArrowRight, Check, XCircle, Target, Play, Code2, FileText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSelectToolbar } from "@/components/batch/multi-select-toolbar";
import { JobProgressModal } from "@/components/batch/job-progress-modal";
import { useGenerateContentBatch } from "@/hooks/use-batch-operations";
import { useAnalysisPipeline } from "@/hooks/use-analysis-pipeline";
import { PipelineProgress } from "@/components/pipeline/pipeline-progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  const [showLookback, setShowLookback] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(90);

  const pipeline = useAnalysisPipeline(workspace as string);
  const queryClient = useQueryClient();

  // Auto-refresh insights when analysis completes
  useEffect(() => {
    if (pipeline.currentStage === "complete") {
      queryClient.invalidateQueries({ queryKey: ["insights", workspace] });
      queryClient.invalidateQueries({ queryKey: ["recommendations", workspace] });
    }
  }, [pipeline.currentStage, workspace, queryClient]);

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

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Batch job state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);

  const generateContentBatch = useGenerateContentBatch(workspace as string);

  // Recommendations
  const recommendations = useQuery<{ recommendations: any[] }>({
    queryKey: ["recommendations", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/content/recommendations?workspace=${workspace}&status=active&limit=10`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!workspace,
  });
  const recList = recommendations.data?.recommendations ?? [];

  // Check if sessions exist for empty state messaging
  const sessionsCheck = useQuery({
    queryKey: ["sessions-check", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/sessions?workspace=${workspace}&limit=1`);
      if (!res.ok) throw new Error("Failed to check sessions");
      return res.json();
    },
    enabled: !!workspace && insightList.length === 0 && !insights.isLoading && !pipeline.isRunning,
  });
  const hasSessions = (sessionsCheck.data?.total ?? 0) > 0;

  const patchRecommendation = useMutation({
    mutationFn: async ({ recommendationId, action }: { recommendationId: string; action: "accepted" | "dismissed" }) => {
      const res = await fetch(`/api/content/recommendations?workspace=${workspace}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, action }),
      });
      if (!res.ok) throw new Error("Failed to update recommendation");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recommendations", workspace] }),
  });

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent, insightId: string, index: number) => {
      e.stopPropagation();

      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (e.shiftKey && lastSelectedIndex !== null) {
          const start = Math.min(lastSelectedIndex, index);
          const end = Math.max(lastSelectedIndex, index);
          const rangeIds: string[] = insightList.slice(start, end + 1).map((ins: any) => ins.id);

          const anchorId = insightList[lastSelectedIndex]?.id;
          if (anchorId && prev.has(anchorId)) {
            rangeIds.forEach((id: string) => next.add(id));
          } else {
            rangeIds.forEach((id: string) => next.delete(id));
          }
        } else {
          if (next.has(insightId)) {
            next.delete(insightId);
          } else {
            next.add(insightId);
          }
          setLastSelectedIndex(index);
        }

        return next;
      });
    },
    [lastSelectedIndex, insightList]
  );

  const handleSelectAll = () => {
    setSelectedIds(new Set(insightList.map((ins: any) => ins.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  };

  const handleGenerateContent = async () => {
    const insightIds = Array.from(selectedIds);
    const result = await generateContentBatch.mutateAsync({ insightIds });
    setActiveJobId(result.jobId);
    setJobModalOpen(true);
    handleClearSelection();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold font-display">Insights</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Start Analysis button with lookback selector */}
          <div className="relative">
            <button
              onClick={() => {
                if (pipeline.isRunning) return;
                setShowLookback(!showLookback);
              }}
              disabled={pipeline.isRunning}
              className={cn(
                "flex items-center gap-2 border px-4 py-2.5 rounded-sf font-medium text-sm transition-colors min-h-[44px]",
                pipeline.isRunning
                  ? "bg-sf-accent/20 border-sf-accent/40 text-sf-accent cursor-wait"
                  : "bg-sf-accent text-sf-bg-primary border-sf-accent hover:bg-sf-accent-dim"
              )}
            >
              <Play size={14} />
              {pipeline.isRunning ? "Analyzing..." : "Start Analysis"}
            </button>
            {showLookback && !pipeline.isRunning && (
              <div className="absolute right-0 top-full mt-2 bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-3 shadow-lg z-20 min-w-[200px]">
                <label className="block text-xs text-sf-text-muted mb-2">Lookback Window</label>
                <select
                  value={lookbackDays}
                  onChange={(e) => setLookbackDays(Number(e.target.value))}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary mb-3"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={36500}>All time</option>
                </select>
                <button
                  onClick={() => {
                    setShowLookback(false);
                    pipeline.startAnalysis(lookbackDays);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
                >
                  <Play size={14} />
                  Start
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "relative flex items-center justify-center gap-2 border px-4 py-2.5 rounded-sf font-medium text-sm transition-colors min-h-[44px]",
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
      </div>

      {/* Pipeline progress trace-back view */}
      {(pipeline.isRunning || pipeline.currentStage === "complete" || pipeline.currentStage === "failed") && (
        <div className="mb-6">
          <PipelineProgress
            events={pipeline.events}
            currentStage={pipeline.currentStage}
            isRunning={pipeline.isRunning}
            error={pipeline.error}
            result={pipeline.result}
          />
        </div>
      )}

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilter("dateFrom", e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilter("dateTo", e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary min-h-[44px]"
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
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none min-h-[44px]"
            />
          </div>
        </div>
      )}

      {/* Suggested Topics from Recommendations */}
      {recList.length > 0 && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-sf-accent" />
            <h3 className="font-semibold text-sf-text-primary text-sm">Suggested Topics</h3>
            <span className="text-xs text-sf-text-muted">({recList.length})</span>
          </div>
          <div className="space-y-2">
            {recList.map((rec: any) => (
              <div
                key={rec.id}
                className="flex items-center gap-3 bg-sf-bg-tertiary rounded-sf px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-sf-text-primary truncate">{rec.title}</p>
                  {rec.description && (
                    <p className="text-xs text-sf-text-secondary line-clamp-1 mt-0.5">{rec.description}</p>
                  )}
                </div>
                <span className={cn(
                  "shrink-0 px-2 py-0.5 rounded-sf-full text-xs font-medium",
                  rec.priority >= 7 ? "text-red-400 bg-red-400/10" :
                  rec.priority >= 4 ? "text-yellow-400 bg-yellow-400/10" :
                  "text-green-400 bg-green-400/10"
                )}>
                  {rec.priority >= 7 ? "High" : rec.priority >= 4 ? "Medium" : "Low"}
                </span>
                <button
                  onClick={() => {
                    patchRecommendation.mutate({ recommendationId: rec.id, action: "accepted" });
                    router.push(`/${workspace}/content/new?topic=${encodeURIComponent(rec.title)}`);
                  }}
                  disabled={patchRecommendation.isPending}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-sf-accent text-sf-bg-primary text-xs font-medium rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                >
                  <Check size={12} />
                  Accept
                </button>
                <button
                  onClick={() => patchRecommendation.mutate({ recommendationId: rec.id, action: "dismissed" })}
                  disabled={patchRecommendation.isPending}
                  className="shrink-0 p-1.5 text-sf-text-muted hover:text-sf-error transition-colors disabled:opacity-50"
                  title="Dismiss"
                >
                  <XCircle size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {recList.length === 0 && !recommendations.isLoading && insightList.length > 0 && (
        <div className="flex items-center gap-2 bg-sf-bg-secondary border border-sf-border rounded-sf px-4 py-3 mb-4 text-sm text-sf-text-muted">
          <Target size={14} />
          No suggested topics. Extract more insights to generate recommendations.
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4">
          <MultiSelectToolbar
            selectedCount={selectedIds.size}
            totalCount={insightList.length}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          >
            <button
              onClick={handleGenerateContent}
              disabled={generateContentBatch.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sf-accent text-sf-bg-primary text-sm font-medium rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
            >
              <Sparkles size={14} />
              {generateContentBatch.isPending ? "Starting..." : "Generate Content"}
            </button>
          </MultiSelectToolbar>
        </div>
      )}

      {insightList.length > 0 && selectedIds.size === 0 && (
        <Link
          href={`/${workspace}/content/new`}
          className="flex items-center justify-between bg-sf-accent-bg border border-sf-accent/20 rounded-sf-lg px-4 py-3 mb-4 group hover:border-sf-accent/40 transition-colors"
        >
          <span className="text-sm text-sf-accent">
            {insightList.length} insights available.{" "}
            <span className="font-medium">Generate Content</span> from your best discoveries.
          </span>
          <ArrowRight size={16} className="text-sf-accent opacity-60 group-hover:opacity-100 transition-opacity" />
        </Link>
      )}

      <div className="space-y-3">
        {insightList.map((ins: any, index: number) => {
          const cat = CATEGORIES[ins.category] ?? { label: ins.category, color: "text-sf-text-secondary bg-sf-bg-tertiary" };
          const isSelected = selectedIds.has(ins.id);
          return (
            <div
              key={ins.id}
              onClick={() => router.push(`/${workspace}/insights/${ins.id}`)}
              className={cn(
                "bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors",
                isSelected && "ring-1 ring-sf-accent bg-sf-accent-bg/30"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  onClick={(e) => handleCheckboxClick(e, ins.id, index)}
                  className="flex-shrink-0"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 accent-sf-accent cursor-pointer"
                  />
                </div>
                <span className={cn("px-2 py-0.5 rounded-sf-full text-xs font-medium", cat.color)}>{cat.label}</span>
                <span className="ml-auto px-3 py-0.5 bg-sf-accent-bg text-sf-accent rounded-sf-full text-sm font-bold font-display">
                  {ins.compositeScore?.toFixed(0) ?? 0}/65
                </span>
              </div>
              <h3 className="font-semibold text-sf-text-primary mb-1">{ins.title}</h3>
              <p className="text-sm text-sf-text-secondary line-clamp-3">{ins.description}</p>
              <div className="flex items-center gap-3 mt-3">
                {/* Evidence indicators */}
                {Array.isArray(ins.codeSnippets) && ins.codeSnippets.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-sf-text-muted" title="Code evidence">
                    <Code2 size={12} />
                    {ins.codeSnippets.length} snippet{ins.codeSnippets.length !== 1 ? "s" : ""}
                  </span>
                )}
                {Array.isArray(ins.terminalOutput) && ins.terminalOutput.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-sf-text-muted" title="Terminal evidence">
                    <FileText size={12} />
                    {ins.terminalOutput.length} output{ins.terminalOutput.length !== 1 ? "s" : ""}
                  </span>
                )}
                {/* Score bars */}
                <div className="flex gap-1 flex-1 ml-auto">
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
            </div>
          );
        })}

        {insightList.length === 0 && !insights.isLoading && !pipeline.isRunning && (
          <div className="text-center py-12">
            <Lightbulb size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-primary font-medium mb-1">No insights yet</p>
            <p className="text-sf-text-secondary mb-6 text-sm max-w-md mx-auto">
              {hasSessions
                ? "Start your first analysis to discover content-worthy patterns, recurring themes, and actionable insights across your sessions."
                : "Import sessions first to unlock insight extraction. Scan your Claude Code projects to get started."}
            </p>
            <div className="flex items-center justify-center gap-3">
              {hasSessions ? (
                <>
                  <button
                    onClick={() => pipeline.startAnalysis(90)}
                    disabled={pipeline.isRunning}
                    className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2.5 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                  >
                    <Play size={14} />
                    Start Analysis (90 days)
                  </button>
                  <Link
                    href={`/${workspace}/sessions`}
                    className="text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
                  >
                    View Sessions →
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={`/${workspace}/sessions`}
                    className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2.5 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
                  >
                    <Zap size={16} />
                    Scan Sessions
                  </Link>
                  <Link
                    href="/onboarding"
                    className="flex items-center gap-1.5 text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
                  >
                    Setup guide
                    <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {activeJobId && (
        <JobProgressModal
          jobId={activeJobId}
          isOpen={jobModalOpen}
          onClose={() => {
            setJobModalOpen(false);
            setActiveJobId(null);
          }}
        />
      )}
    </div>
  );
}
