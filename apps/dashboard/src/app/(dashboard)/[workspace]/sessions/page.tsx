"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSessions, useScanSessions, useStreamingScan, ScanResult, ScanProgressEvent } from "@/hooks/use-sessions";
import { useFilterParams } from "@/hooks/use-filter-params";
import { timeAgo, formatDuration, cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { Zap, ScrollText, SlidersHorizontal, X, RotateCcw, Sparkles } from "lucide-react";
import { MultiSelectToolbar } from "@/components/batch/multi-select-toolbar";
import { JobProgressModal } from "@/components/batch/job-progress-modal";
import { useExtractInsightsBatch } from "@/hooks/use-batch-operations";

const FILTER_DEFAULTS = {
  dateFrom: "",
  dateTo: "",
  project: "",
  minMessages: "",
  maxMessages: "",
  hasSummary: "",
};

export default function SessionsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const limit = 20;

  const [filters, setFilter, resetFilters] = useFilterParams(FILTER_DEFAULTS);

  const hasSummaryValue =
    filters.hasSummary === "has_summary"
      ? true
      : filters.hasSummary === "no_summary"
        ? false
        : undefined;

  const sessions = useSessions(workspace, {
    limit,
    offset,
    project: filters.project || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    minMessages: filters.minMessages ? Number(filters.minMessages) : undefined,
    maxMessages: filters.maxMessages ? Number(filters.maxMessages) : undefined,
    hasSummary: hasSummaryValue,
  });

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Batch job state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const scan = useScanSessions(workspace);
  const streamingScan = useStreamingScan(workspace);
  const sessionList = sessions.data?.data ?? [];

  const extractInsightsBatch = useExtractInsightsBatch(workspace as string);

  const workspaceData = useQuery({
    queryKey: ["workspace", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}`);
      if (!res.ok) throw new Error("Failed to fetch workspace");
      return res.json();
    },
    enabled: !!workspace,
  });

  const lastScanAt = lastScanResult?.lastScanAt ?? workspaceData.data?.lastScanAt;

  const handleScan = (fullRescan = false) => {
    if (fullRescan) {
      // Full rescan uses the non-streaming endpoint (re-indexes everything)
      scan.mutate(
        { lookbackDays: 30, fullRescan },
        { onSuccess: (result) => setLastScanResult(result) }
      );
    } else {
      // Incremental scan uses streaming for real-time progress
      streamingScan.startScan({ lookbackDays: 30 });
    }
  };

  const isBusy = scan.isPending || streamingScan.isScanning;
  const streamProgress = streamingScan.progress;

  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent, sessionId: string, index: number) => {
      e.stopPropagation();

      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (e.shiftKey && lastSelectedIndex !== null) {
          // Range selection: determine range boundaries
          const start = Math.min(lastSelectedIndex, index);
          const end = Math.max(lastSelectedIndex, index);
          const rangeIds: string[] = sessionList.slice(start, end + 1).map((s: any) => s.id);

          // If the anchor item is selected, add the range; otherwise remove it
          const anchorId = sessionList[lastSelectedIndex]?.id;
          if (anchorId && prev.has(anchorId)) {
            rangeIds.forEach((id: string) => next.add(id));
          } else {
            rangeIds.forEach((id: string) => next.delete(id));
          }
        } else {
          // Single toggle
          if (next.has(sessionId)) {
            next.delete(sessionId);
          } else {
            next.add(sessionId);
          }
          setLastSelectedIndex(index);
        }

        return next;
      });
    },
    [lastSelectedIndex, sessionList]
  );

  const handleSelectAll = () => {
    setSelectedIds(new Set(sessionList.map((s: any) => s.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  };

  const handleExtractInsights = async () => {
    const ids = Array.from(selectedIds);
    const result = await extractInsightsBatch.mutateAsync(ids);
    setActiveJobId(result.jobId);
    setJobModalOpen(true);
    handleClearSelection();
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Sessions</h1>
          {lastScanAt && (
            <p className="text-xs text-sf-text-muted mt-0.5">
              Last scan: {timeAgo(lastScanAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
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
          <button
            onClick={() => handleScan(true)}
            disabled={isBusy}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary px-3 py-2 rounded-sf text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Full Rescan
          </button>
          <button
            onClick={() => handleScan(false)}
            disabled={isBusy}
            className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            <Zap size={16} />
            {isBusy ? "Scanning..." : "Scan Now"}
          </button>
        </div>
      </div>

      {streamingScan.isScanning && streamProgress && (
        <div className="bg-sf-bg-secondary border border-sf-accent/30 rounded-sf px-4 py-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-sf-accent">
              {streamProgress.type === "start" && `Scanning ${streamProgress.total} files...`}
              {streamProgress.type === "progress" && `Scanning file ${streamProgress.current} of ${streamProgress.total}`}
            </span>
            <button onClick={streamingScan.cancel} className="text-xs text-sf-text-muted hover:text-sf-text-secondary">Cancel</button>
          </div>
          {streamProgress.type === "progress" && (
            <>
              <div className="w-full bg-sf-bg-tertiary rounded-full h-1.5 mb-2">
                <div
                  className="bg-sf-accent h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(streamProgress.current / streamProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-sf-text-muted truncate">
                {streamProgress.projectPath}
              </p>
            </>
          )}
        </div>
      )}

      {streamProgress?.type === "complete" && !streamingScan.isScanning && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf px-4 py-2 mb-4 flex items-center gap-4 text-xs">
          <span className="text-sf-accent font-medium">Scan complete</span>
          <span className="text-sf-text-secondary">
            <span className="text-sf-text-primary font-medium">{streamProgress.scanned}</span> scanned
          </span>
          <span className="text-sf-text-secondary">
            <span className="text-sf-text-primary font-medium">{streamProgress.new}</span> new
          </span>
          <span className="text-sf-text-secondary">
            <span className="text-sf-text-primary font-medium">{streamProgress.updated}</span> updated
          </span>
          {streamProgress.errors.length > 0 && (
            <span className="text-red-400">{streamProgress.errors.length} errors</span>
          )}
          <span className="text-sf-text-muted ml-auto">
            {(streamProgress.durationMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {streamProgress?.type === "error" && !streamingScan.isScanning && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-sf px-4 py-2 mb-4 text-xs text-red-400">
          Scan error: {streamProgress.message}
        </div>
      )}

      {lastScanResult && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf px-4 py-2 mb-4 flex items-center gap-4 text-xs">
          <span className="text-sf-accent font-medium">
            {lastScanResult.isIncremental ? "Incremental scan" : "Full rescan"} complete
          </span>
          <span className="text-sf-text-secondary">
            <span className="text-sf-text-primary font-medium">{lastScanResult.new}</span> new
          </span>
          <span className="text-sf-text-secondary">
            <span className="text-sf-text-primary font-medium">{lastScanResult.updated}</span> updated
          </span>
          <span className="text-sf-text-secondary">
            <span className="text-sf-text-primary font-medium">{lastScanResult.scanned}</span> scanned
          </span>
          <span className="text-sf-text-muted ml-auto">
            {(lastScanResult.durationMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {showFilters && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sf-text-primary text-sm">Filters</h3>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    resetFilters();
                    setOffset(0);
                  }}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => {
                  setFilter("dateFrom", e.target.value);
                  setOffset(0);
                }}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => {
                  setFilter("dateTo", e.target.value);
                  setOffset(0);
                }}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-sf-text-muted mb-1">Project</label>
            <input
              type="text"
              placeholder="Filter by project name..."
              value={filters.project}
              onChange={(e) => {
                setFilter("project", e.target.value);
                setOffset(0);
              }}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">Min Messages</label>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={filters.minMessages}
                onChange={(e) => {
                  setFilter("minMessages", e.target.value);
                  setOffset(0);
                }}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">Max Messages</label>
              <input
                type="number"
                min={0}
                placeholder="∞"
                value={filters.maxMessages}
                onChange={(e) => {
                  setFilter("maxMessages", e.target.value);
                  setOffset(0);
                }}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-sf-text-muted mb-1">Summary</label>
            <select
              value={filters.hasSummary}
              onChange={(e) => {
                setFilter("hasSummary", e.target.value);
                setOffset(0);
              }}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
            >
              <option value="">All Sessions</option>
              <option value="has_summary">Has Summary</option>
              <option value="no_summary">No Summary</option>
            </select>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4">
          <MultiSelectToolbar
            selectedCount={selectedIds.size}
            totalCount={sessionList.length}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          >
            <button
              onClick={handleExtractInsights}
              disabled={extractInsightsBatch.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sf-accent text-sf-bg-primary text-sm font-medium rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
            >
              <Sparkles size={14} />
              {extractInsightsBatch.isPending ? "Starting..." : "Extract Insights"}
            </button>
          </MultiSelectToolbar>
        </div>
      )}

      <div className="space-y-3">
        {sessionList.map((s: any, index: number) => {
          const isSelected = selectedIds.has(s.id);
          return (
            <div
              key={s.id}
              onClick={() => router.push(`/${workspace}/sessions/${s.id}`)}
              className={cn(
                "bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors border-l-[3px] border-l-sf-accent",
                isSelected && "ring-1 ring-sf-accent bg-sf-accent-bg/30"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <div
                    onClick={(e) => handleCheckboxClick(e, s.id, index)}
                    className={cn(
                      "flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border transition-colors cursor-pointer",
                      isSelected
                        ? "border-sf-accent bg-sf-accent"
                        : "border-sf-border hover:border-sf-accent"
                    )}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Select session ${s.projectName}`}
                  >
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-sf-bg-primary" />
                      </svg>
                    )}
                  </div>
                  <h3 className="font-semibold text-sf-text-primary">{s.projectName}</h3>
                </div>
                <span className="text-xs text-sf-text-muted">{s.startedAt ? timeAgo(s.startedAt) : ""}</span>
              </div>
              <p className="text-xs text-sf-text-secondary mb-2 pl-7">
                {s.messageCount} messages{s.filesModified?.length ? ` · ${s.filesModified.length} files` : ""}
                {s.toolsUsed?.length ? ` · ${s.toolsUsed.slice(0, 4).join(", ")}` : ""}
                {s.durationSeconds ? ` · ${formatDuration(s.durationSeconds)}` : ""}
              </p>
              {s.summary && (
                <p className="text-sm text-sf-text-secondary truncate pl-7">{s.summary}</p>
              )}
            </div>
          );
        })}

        {sessionList.length === 0 && !sessions.isLoading && (
          <div className="text-center py-12">
            <ScrollText size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-primary font-medium mb-1">No sessions found</p>
            <p className="text-sf-text-secondary mb-6 text-sm">Scan your Claude projects to import sessions and start generating insights.</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleScan(false)}
                disabled={isBusy}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
              >
                <Zap size={16} />
                {isBusy ? "Scanning..." : "Scan Now"}
              </button>
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

      {sessionList.length >= limit && (
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm bg-sf-bg-tertiary border border-sf-border rounded-sf text-sf-text-secondary hover:bg-sf-bg-hover disabled:opacity-30"
          >
            Prev
          </button>
          <button
            onClick={() => setOffset(offset + limit)}
            className="px-4 py-2 text-sm bg-sf-bg-tertiary border border-sf-border rounded-sf text-sf-text-secondary hover:bg-sf-bg-hover"
          >
            Next
          </button>
        </div>
      )}

      <JobProgressModal
        jobId={activeJobId}
        title="Extracting Insights"
        isOpen={jobModalOpen}
        onClose={() => { setJobModalOpen(false); setActiveJobId(null); }}
      />
    </div>
  );
}
