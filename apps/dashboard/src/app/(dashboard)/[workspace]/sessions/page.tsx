"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSessions, useScanSessions, ScanResult } from "@/hooks/use-sessions";
import { timeAgo, formatDuration } from "@/lib/utils";
import { useState } from "react";
import { Zap, ScrollText, RotateCcw } from "lucide-react";

export default function SessionsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [project, setProject] = useState("");
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const limit = 20;

  const sessions = useSessions(workspace, { limit, offset, project: project || undefined });
  const scan = useScanSessions(workspace);
  const sessionList = sessions.data?.sessions ?? [];

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
    scan.mutate(
      { lookbackDays: 30, fullRescan },
      { onSuccess: (result) => setLastScanResult(result) }
    );
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
            onClick={() => handleScan(true)}
            disabled={scan.isPending}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary px-3 py-2 rounded-sf text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Full Rescan
          </button>
          <button
            onClick={() => handleScan(false)}
            disabled={scan.isPending}
            className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            <Zap size={16} />
            {scan.isPending ? "Scanning..." : "Scan Now"}
          </button>
        </div>
      </div>

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
        <input
          type="text"
          placeholder="Filter by project name..."
          value={project}
          onChange={(e) => { setProject(e.target.value); setOffset(0); }}
          className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none w-full max-w-sm"
        />
      </div>

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
            <p className="text-sf-text-secondary">No sessions found. Try scanning or expanding the lookback window.</p>
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
