"use client";

import { useQuery } from "@tanstack/react-query";
import { ACTIVE_STATUSES } from "@/lib/pipeline-status";

export interface StageLatency {
  avgMs: number;
  count: number;
}

export interface PipelineMetrics {
  workspace: string;
  dateRange: { since: string; until: string };
  totalRuns: number;
  stateCounts: Record<string, number>;
  failureRate: number;
  throughput: number;
  avgDurationMs: number;
  queueDepth: number;
  stageLatency: Record<string, StageLatency>;
}

export interface PipelineMetricsFilter {
  since?: string;
  until?: string;
  platform?: string;
}

export function usePipelineMetrics(
  workspace: string,
  filters?: PipelineMetricsFilter,
) {
  return useQuery<PipelineMetrics>({
    queryKey: ["pipeline-metrics", workspace, filters],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (filters?.since) sp.set("since", filters.since);
      if (filters?.until) sp.set("until", filters.until);
      if (filters?.platform) sp.set("platform", filters.platform);
      const res = await fetch(
        `/api/observability/metrics?${sp.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch pipeline metrics");
      return res.json();
    },
    enabled: !!workspace,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = ACTIVE_STATUSES.some(
        (s) => (data.stateCounts[s] ?? 0) > 0,
      );
      return hasActive ? 3_000 : false;
    },
  });
}
