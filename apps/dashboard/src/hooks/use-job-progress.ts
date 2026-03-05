"use client";

import { useQuery } from "@tanstack/react-query";

export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export type JobProgress = {
  id: string;
  type: string;
  status: JobStatus;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  progressPercent: number;
  estimatedSecondsRemaining: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
};

const ACTIVE_STATUSES: JobStatus[] = ["pending", "processing"];
const POLL_INTERVAL_MS = 2000;

export function useJobProgress(jobId: string | null) {
  return useQuery<JobProgress>({
    queryKey: ["job-progress", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch job progress");
      const data = await res.json();

      const processed = data.processedItems ?? 0;
      const total = data.totalItems ?? 0;
      const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

      let estimatedSecondsRemaining: number | null = null;
      const startRef = data.startedAt ?? data.createdAt ?? null;
      if (startRef && data.status === "processing" && processed > 0) {
        const elapsedMs = Date.now() - new Date(startRef).getTime();
        const msPerItem = elapsedMs / processed;
        const remaining = total - processed;
        estimatedSecondsRemaining = Math.round((msPerItem * remaining) / 1000);
      }

      return {
        id: data.id,
        type: data.type,
        status: data.status as JobStatus,
        totalItems: total,
        processedItems: processed,
        successItems: data.successCount ?? data.successItems ?? 0,
        failedItems: data.errorCount ?? data.failedItems ?? 0,
        progressPercent,
        estimatedSecondsRemaining,
        startedAt: data.startedAt ?? data.createdAt ?? null,
        completedAt: data.completedAt ?? null,
        errorMessage: data.errorMessage ?? null,
        metadata: data.metadata ?? null,
      };
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || ACTIVE_STATUSES.includes(status)) {
        return POLL_INTERVAL_MS;
      }
      return false;
    },
  });
}
