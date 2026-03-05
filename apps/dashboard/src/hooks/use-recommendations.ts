"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useRecommendations(
  workspace: string,
  params?: { limit?: number; offset?: number; type?: string; status?: string }
) {
  return useQuery({
    queryKey: ["recommendations", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.type) sp.set("type", params.type);
      if (params?.status) sp.set("status", params.status);
      const res = await fetch(`/api/content/recommendations?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!workspace,
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
    onSuccess: (_, id) => {
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
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["recommendation"] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });
}
