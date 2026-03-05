"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useInsights(workspace: string, params?: { limit?: number; offset?: number; minScore?: number; category?: string }) {
  return useQuery({
    queryKey: ["insights", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.minScore) sp.set("minScore", String(params.minScore));
      if (params?.category) sp.set("category", params.category);
      const res = await fetch(`/api/insights?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useInsight(id: string) {
  return useQuery({
    queryKey: ["insight", id],
    queryFn: async () => {
      const res = await fetch(`/api/insights/${id}`);
      if (!res.ok) throw new Error("Failed to fetch insight");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useExtractInsights(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionIds: string[]) => {
      const res = await fetch("/api/insights/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, sessionIds }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });
}
