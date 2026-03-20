"use client";

import { useQuery } from "@tanstack/react-query";

export interface RunDetail {
  run: {
    id: string;
    triggerId: string | null;
    workspaceId: string;
    source: string;
    status: string;
    sessionsScanned: number;
    insightsExtracted: number;
    postId: string | null;
    errorMessage: string | null;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    triggerName: string | null;
    triggerType: string | null;
  };
  events: Array<{
    id: string;
    agentType: string;
    eventType: string;
    level: string;
    message: string;
    createdAt: string;
    [key: string]: unknown;
  }>;
  agentRuns: Array<{
    id: string;
    agentType: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    [key: string]: unknown;
  }>;
  publishStatus: {
    postId: string;
    title: string;
    status: string;
    contentType: string;
    publishedAt: string | null;
    createdAt: string | null;
  } | null;
}

export function useRunDetail(workspace: string, runId?: string | null) {
  return useQuery<RunDetail>({
    queryKey: ["run-detail", workspace, runId],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(
        `/api/observability/runs/${runId}?${sp.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch run detail");
      return res.json();
    },
    enabled: !!workspace && !!runId,
  });
}
