"use client";

import {
  Activity,
  AlertTriangle,
  Clock,
  Layers,
  Loader2,
  Percent,
  RefreshCw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusBadgeClass, statusLabel } from "@/lib/pipeline-status";

export interface PipelineMetricsData {
  activeJobs: number;
  failureRate: number;
  throughput: number;
  avgLatencyMs: number;
  queueDepth: number;
  byStatus: Record<string, number>;
}

interface PipelineMetricsProps {
  data: PipelineMetricsData | null;
  isLoading: boolean;
  isError: boolean;
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 flex items-center gap-3">
      <div className="p-2 rounded-sf bg-sf-bg-tertiary text-sf-text-secondary">{icon}</div>
      <div>
        <p className="text-xs text-sf-text-secondary">{label}</p>
        <p className="text-xl font-bold font-display text-sf-text-primary">{value}</p>
      </div>
    </div>
  );
}

function MetricTileSkeleton() {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 flex items-center gap-3 animate-pulse">
      <div className="p-2 rounded-sf bg-sf-bg-tertiary w-9 h-9" />
      <div className="space-y-2">
        <div className="h-3 w-16 bg-sf-bg-tertiary rounded" />
        <div className="h-6 w-12 bg-sf-bg-tertiary rounded" />
      </div>
    </div>
  );
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const rem = Math.round(secs % 60);
  return `${mins}m ${rem}s`;
}

function StatusBar({ byStatus }: { byStatus: Record<string, number> }) {
  const entries = Object.entries(byStatus).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (total === 0) return null;

  const statusColorClass: Record<string, string> = {
    complete: "bg-green-500",
    failed: "bg-red-500",
    scanning: "bg-sf-accent",
    extracting: "bg-sf-accent",
    generating: "bg-sf-accent",
    pending: "bg-yellow-500",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-sf-text-secondary uppercase tracking-wide">
          Runs by Status
        </h3>
        <span className="text-xs text-sf-text-muted">({total} total)</span>
      </div>
      <div className="flex h-3 rounded-sf-full overflow-hidden bg-sf-bg-tertiary">
        {entries.map(([status, count]) => (
          <div
            key={status}
            className={cn("transition-all", statusColorClass[status] ?? "bg-sf-bg-tertiary")}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${statusLabel(status)}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {entries.map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
            <span className="text-xs font-medium text-sf-text-primary">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelineMetrics({ data, isLoading, isError }: PipelineMetricsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MetricTileSkeleton key={i} />
          ))}
        </div>
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 animate-pulse">
          <div className="h-3 w-24 bg-sf-bg-tertiary rounded mb-3" />
          <div className="h-3 w-full bg-sf-bg-tertiary rounded-sf-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-sf-lg p-4 flex items-center gap-3">
        <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
        <p className="text-red-400 text-sm">
          Failed to load pipeline metrics. Check your connection and try again.
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricTile
          icon={<Activity size={18} />}
          label="Active Jobs"
          value={data.activeJobs.toLocaleString()}
        />
        <MetricTile
          icon={<Percent size={18} />}
          label="Failure Rate"
          value={`${data.failureRate.toFixed(1)}%`}
        />
        <MetricTile
          icon={<Zap size={18} />}
          label="Throughput"
          value={`${data.throughput.toFixed(1)}/day`}
        />
        <MetricTile
          icon={<Clock size={18} />}
          label="Avg Latency"
          value={formatLatency(data.avgLatencyMs)}
        />
        <MetricTile
          icon={<Layers size={18} />}
          label="Queue Depth"
          value={data.queueDepth.toLocaleString()}
        />
      </div>

      <StatusBar byStatus={data.byStatus} />
    </div>
  );
}
