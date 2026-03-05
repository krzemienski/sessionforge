"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useRecommendations(
  workspace: string,
  params?: { limit?: number; offset?: number; minScore?: number; type?: string; status?: string }
) {
  return useQuery({
    queryKey: ["recommendations", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.minScore) sp.set("minScore", String(params.minScore));
      if (params?.type) sp.set("type", params.type);
      if (params?.status) sp.set("status", params.status);
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

export function useRecommendation(workspace: string, id: string) {
  return useQuery({
    queryKey: ["recommendation", workspace, id],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/content/recommendations?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      const data = await res.json();
      const found = (data.recommendations ?? []).find(
        (r: { id: string }) => r.id === id
      );
      if (!found) throw new Error("Recommendation not found");
      return found;
    },
    enabled: !!workspace && !!id,
  });
}

export function useAcceptRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content/recommendations/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!res.ok) throw new Error("Failed to accept recommendation");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendation"] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useDismissRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content/recommendations/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (!res.ok) throw new Error("Failed to dismiss recommendation");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendation"] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });
}
