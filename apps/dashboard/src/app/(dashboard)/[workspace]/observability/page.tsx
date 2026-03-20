"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Activity, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { PipelineFlow } from "@/components/pipeline/pipeline-flow";
import { PipelineFilters, type DateRange, type ContentType, type PipelineStatus } from "@/components/pipeline/pipeline-filters";
import { PipelineMetrics, type PipelineMetricsData } from "@/components/pipeline/pipeline-metrics";
import { PipelineThroughputChart } from "@/components/pipeline/pipeline-throughput-chart";
import { PipelineLatencyChart } from "@/components/pipeline/pipeline-latency-chart";
import { RunDetailPanel } from "@/components/pipeline/run-detail-panel";
import { usePipelineMetrics } from "@/hooks/use-pipeline-metrics";
import { useRunDetail } from "@/hooks/use-run-detail";
import { formatMs, timeAgo } from "@/lib/utils";
import { type PipelineRun, statusBadgeClass, statusLabel, ACTIVE_STATUSES, dateRangeFromTimeframe } from "@/lib/pipeline-status";

export default function ObservabilityPage() {
  const { workspace } = useParams<{ workspace: string }>();

  // Filter state
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [contentType, setContentType] = useState<ContentType>("all");
  const [statusFilter, setStatusFilter] = useState<PipelineStatus>("all");

  // Selected run for detail panel
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Build metrics filter from filter state
  const metricsFilter = useMemo(() => {
    if (dateRange === "all") return {};
    const range = dateRangeFromTimeframe(dateRange);
    return {
      since: range.since,
      until: range.until,
      ...(contentType !== "all" ? { platform: contentType } : {}),
    };
  }, [dateRange, contentType]);

  // Pipeline metrics hook
  const metrics = usePipelineMetrics(workspace, metricsFilter);

  // Existing pipeline runs query (preserved real-time refetch behavior)
  const runs = useQuery({
    queryKey: ["pipeline-runs", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/automation/runs?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load pipeline runs");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as { runs?: PipelineRun[] } | undefined;
      const hasActive = (data?.runs ?? []).some((r) => ACTIVE_STATUSES.includes(r.status));
      return hasActive ? 3000 : 0;
    },
  });

  // Run detail hook for selected run
  const runDetail = useRunDetail(workspace, selectedRunId);

  const runList: PipelineRun[] = runs.data?.runs ?? [];
  const lastRun = runList.length > 0 ? runList[0] : null;

  // Map metrics data to the PipelineMetrics component shape
  const metricsData: PipelineMetricsData | null = metrics.data
    ? {
        activeJobs: ACTIVE_STATUSES.reduce(
          (sum, s) => sum + (metrics.data!.stateCounts[s] ?? 0),
          0,
        ),
        failureRate: metrics.data.failureRate * 100,
        throughput: metrics.data.throughput,
        avgLatencyMs: metrics.data.avgDurationMs,
        queueDepth: metrics.data.queueDepth,
        byStatus: metrics.data.stateCounts,
      }
    : null;

  // Build chart data from metrics response
  const dailyThroughput = useMemo(() => {
    const raw = (metrics.data as Record<string, unknown> | undefined)?.dailyThroughput as
      | Array<{ date: string; runs: number; failures: number }>
      | undefined;
    if (!raw) return [];
    return raw.map((d) => ({
      date: d.date,
      total: d.runs,
      succeeded: d.runs - d.failures,
      failed: d.failures,
    }));
  }, [metrics.data]);

  const stageLatencies = useMemo(() => {
    const sl = metrics.data?.stageLatency;
    return {
      scanning: sl?.scanning?.avgMs ?? 0,
      extracting: sl?.extracting?.avgMs ?? 0,
      generating: sl?.generating?.avgMs ?? 0,
    };
  }, [metrics.data]);

  // Filter run list by status filter
  const filteredRuns = useMemo(() => {
    if (statusFilter === "all") return runList;
    if (statusFilter === "active") {
      return runList.filter((r) => ACTIVE_STATUSES.includes(r.status));
    }
    if (statusFilter === "failed") {
      return runList.filter((r) => r.status === "failed");
    }
    if (statusFilter === "complete") {
      return runList.filter((r) => r.status === "complete");
    }
    return runList;
  }, [runList, statusFilter]);

  return (
    <div>
      {/* 1. Header with title + subtitle */}
      <div className="flex items-center gap-3 mb-6">
        <Activity size={24} className="text-sf-accent" />
        <div>
          <h1 className="text-2xl font-bold font-display">Pipeline</h1>
          <p className="text-sm text-sf-text-muted">
            Session ingestion, insight extraction, and content generation flow
          </p>
        </div>
      </div>

      {/* 2. PipelineFilters bar */}
      <div className="mb-6">
        <PipelineFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          contentType={contentType}
          onContentTypeChange={setContentType}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          showStatusFilter
        />
      </div>

      {/* 3. PipelineMetrics summary cards */}
      <div className="mb-6">
        <PipelineMetrics
          data={metricsData}
          isLoading={metrics.isLoading}
          isError={metrics.isError}
        />
      </div>

      {/* 4. PipelineFlow diagram (existing, kept as-is) */}
      <PipelineFlow lastRun={lastRun} workspace={workspace} />

      {/* 5. Two-column chart section */}
      {metrics.data && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PipelineThroughputChart dailyThroughput={dailyThroughput} />
          <PipelineLatencyChart stageLatencies={stageLatencies} />
        </div>
      )}

      {/* 6. Run History table with clickable rows expanding to RunDetailPanel */}
      {filteredRuns.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-sf-text-primary uppercase tracking-wide mb-3 font-display">
            Run History
          </h2>
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sf-border text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide">Trigger</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide hidden sm:table-cell">Sessions</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide hidden sm:table-cell">Insights</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide hidden md:table-cell">Duration</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide">When</th>
                  <th className="px-4 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredRuns.slice(0, 20).map((run) => {
                  const isSelected = selectedRunId === run.id;

                  return (
                    <tr
                      key={run.id}
                      className="border-b border-sf-border/50 last:border-0"
                    >
                      <td colSpan={7} className="p-0">
                        {/* Clickable row */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setSelectedRunId(isSelected ? null : run.id ?? null)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedRunId(isSelected ? null : run.id ?? null);
                            }
                          }}
                          className="w-full text-left flex items-center hover:bg-sf-bg-tertiary/50 transition-colors cursor-pointer"
                        >
                          <span className="px-4 py-2.5">
                            <span className={statusBadgeClass(run.status)}>
                              {statusLabel(run.status)}
                            </span>
                          </span>
                          <span className="flex-1 px-4 py-2.5 text-sf-text-secondary truncate">
                            {run.triggerName ?? "—"}
                          </span>
                          <span className="px-4 py-2.5 text-sf-text-secondary hidden sm:inline">
                            {run.sessionsScanned ?? "—"}
                          </span>
                          <span className="px-4 py-2.5 text-sf-text-secondary hidden sm:inline">
                            {run.insightsExtracted ?? "—"}
                          </span>
                          <span className="px-4 py-2.5 text-sf-text-muted hidden md:inline">
                            {run.durationMs ? formatMs(run.durationMs) : "—"}
                          </span>
                          <span className="px-4 py-2.5 text-sf-text-muted">
                            {run.startedAt ? timeAgo(run.startedAt) : "—"}
                          </span>
                          <span className="px-4 py-2.5 text-sf-text-muted">
                            {isSelected ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </span>
                        </div>

                        {/* Expanded detail panel */}
                        {isSelected && runDetail.data && (
                          <div className="px-4 pb-4 pt-2">
                            <RunDetailPanel
                              runDetail={runDetail.data}
                              onClose={() => setSelectedRunId(null)}
                            />
                          </div>
                        )}

                        {isSelected && runDetail.isLoading && (
                          <div className="flex items-center justify-center py-6">
                            <RefreshCw size={16} className="animate-spin text-sf-text-muted mr-2" />
                            <span className="text-sm text-sf-text-muted">Loading run details…</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
