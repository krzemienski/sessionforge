"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useRecommendations(workspace: string, params?: { limit?: number; offset?: number; type?: string; status?: string }) {
  return useQuery({
    queryKey: ["recommendations", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.type) sp.set("type", params.type);
      if (params?.status) sp.set("status", params.status);
      const res = await fetch(`/api/recommendations?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useRecommendation(id: string) {
  return useQuery({
    queryKey: ["recommendation", id],
    queryFn: async () => {
      const res = await fetch(`/api/recommendations/${id}`);
      if (!res.ok) throw new Error("Failed to fetch recommendation");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useAcceptRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recommendations/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to accept recommendation");
      return res.json();
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["recommendation", id] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });
}

export function useDismissRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recommendations/${id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to dismiss recommendation");
      return res.json();
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["recommendation", id] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });
}
