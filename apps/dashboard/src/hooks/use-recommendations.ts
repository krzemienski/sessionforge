"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useRecommendations(
  workspace: string,
  params?: { limit?: number; offset?: number; minScore?: number }
) {
  return useQuery({
    queryKey: ["recommendations", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.minScore) sp.set("minScore", String(params.minScore));
      const res = await fetch(`/api/recommendations?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useGenerateRecommendations(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customInstructions?: string) => {
      const res = await fetch("/api/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, customInstructions }),
      });
      if (!res.ok) throw new Error("Generation failed");
      // Drain the SSE stream to completion before resolving
      const reader = res.body?.getReader();
      if (reader) {
        try {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } finally {
          reader.releaseLock();
        }
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["recommendations", workspace] }),
  });
}

export function useRateRecommendation(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      helpful,
    }: {
      id: string;
      helpful: boolean;
    }) => {
      const res = await fetch(`/api/recommendations/${id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful }),
      });
      if (!res.ok) throw new Error("Rating failed");
      return res.json() as Promise<{ rated: boolean; helpfulRating: boolean }>;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["recommendations", workspace] }),
  });
}
