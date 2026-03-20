"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useResearchItems(postId: string, params?: { tag?: string }) {
  return useQuery({
    queryKey: ["research", postId, params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.tag) sp.set("tag", params.tag);
      const qs = sp.toString();
      const res = await fetch(`/api/content/${postId}/research${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch research items");
      return res.json();
    },
    enabled: !!postId,
  });
}

export function useCreateResearchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      ...data
    }: {
      postId: string;
      type: "link" | "note" | "code_snippet" | "session_snippet";
      title: string;
      content?: string;
      url?: string;
      tags?: string[];
      credibilityRating?: number;
      sessionId?: string;
      messageIndex?: number;
      metadata?: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/content/${postId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create research item");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["research", vars.postId] });
    },
  });
}

export function useUpdateResearchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      itemId,
      ...data
    }: {
      postId: string;
      itemId: string;
      type?: "link" | "note" | "code_snippet" | "session_snippet";
      title?: string;
      content?: string | null;
      url?: string | null;
      tags?: string[];
      credibilityRating?: number | null;
      sessionId?: string | null;
      messageIndex?: number | null;
      metadata?: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/content/${postId}/research/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update research item");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["research", vars.postId] });
    },
  });
}

export function useDeleteResearchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, itemId }: { postId: string; itemId: string }) => {
      const res = await fetch(`/api/content/${postId}/research/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete research item");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["research", vars.postId] });
    },
  });
}
