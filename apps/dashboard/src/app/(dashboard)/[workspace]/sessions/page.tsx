"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSessions, useScanSessions, useStreamingScan, useUploadSessions, ScanResult, ScanProgressEvent, UploadResult } from "@/hooks/use-sessions";
import { useFilterParams } from "@/hooks/use-filter-params";
import { timeAgo, formatDuration, cn } from "@/lib/utils";
import { useState } from "react";
import { Zap, ScrollText, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { UploadZone } from "@/components/sessions/upload-zone";
import { UploadProgress, UploadState, UploadStats } from "@/components/sessions/upload-progress";
import type { UploadedFileResult } from "@/lib/sessions/upload-processor";

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
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadFiles, setUploadFiles] = useState<Array<{ name: string; size?: number }>>([]);
  const [uploadResults, setUploadResults] = useState<UploadedFileResult[]>([]);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
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

  const scan = useScanSessions(workspace);
  const streamingScan = useStreamingScan(workspace);
  const upload = useUploadSessions();
  const sessionList = sessions.data?.data ?? [];

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

  const handleFilesSelected = (files: File[]) => {
    // Reset state
    setUploadState("uploading");
    setUploadFiles(files.map(f => ({ name: f.name, size: f.size })));
    setUploadResults([]);
    setUploadStats(null);

    // Trigger upload mutation
    upload.mutate(files, {
      onSuccess: (result: UploadResult) => {
        setUploadState("complete");
        setUploadStats({
          uploaded: result.uploaded,
          new: result.new,
          updated: result.updated,
          errors: result.errors.length,
        });
        // Create upload results from API response
        const results: UploadedFileResult[] = files.map((file, idx) => ({
          sessionId: file.name.replace(".jsonl", ""),
          status: "success",
          isNew: idx < result.new,
        }));
        setUploadResults(results);
      },
      onError: (error: Error) => {
        setUploadState("error");
        setUploadResults(
          files.map(f => ({
            sessionId: f.name.replace(".jsonl", ""),
            status: "error",
            error: error.message,
          }))
        );
      },
    });
  };

  const handleCloseUpload = () => {
    setUploadState("idle");
    setUploadFiles([]);
    setUploadResults([]);
    setUploadStats(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Sessions</h1>
          {lastScanAt && (
            <p className="text-xs text-sf-text-muted mt-0.5">
              Last scan: {timeAgo(lastScanAt)}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:mt-1">
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
            className="flex items-center justify-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary px-3 py-2.5 rounded-sf text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <RotateCcw size={14} />
            Full Rescan
          </button>
          <button
            onClick={() => handleScan(false)}
            disabled={isBusy}
            className="flex items-center justify-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2.5 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50 min-h-[44px]"
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

      <div className="mb-4">
        <UploadZone
          onFilesSelected={handleFilesSelected}
          isUploading={upload.isPending}
        />
      </div>

      {uploadState !== "idle" && (
        <div className="mb-4">
          <UploadProgress
            state={uploadState}
            files={uploadFiles}
            results={uploadResults}
            stats={uploadStats ?? undefined}
            onClose={uploadState === "complete" ? handleCloseUpload : undefined}
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

      <div className="space-y-3">
        {sessionList.map((s: any) => (
          <div
            key={s.id}
            onClick={() => router.push(`/${workspace}/sessions/${s.id}`)}
            className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors border-l-[3px] border-l-sf-accent"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sf-text-primary">{s.projectName}</h3>
              <span className="text-xs text-sf-text-muted">{s.startedAt ? timeAgo(s.startedAt) : ""}</span>
            </div>
            <p className="text-xs text-sf-text-secondary mb-2">
              {s.messageCount} messages{s.filesModified?.length ? ` · ${s.filesModified.length} files` : ""}
              {s.toolsUsed?.length ? ` · ${s.toolsUsed.slice(0, 4).join(", ")}` : ""}
              {s.durationSeconds ? ` · ${formatDuration(s.durationSeconds)}` : ""}
            </p>
            {s.summary && (
              <p className="text-sm text-sf-text-secondary truncate">{s.summary}</p>
            )}
          </div>
        ))}

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
    </div>
  );
}
