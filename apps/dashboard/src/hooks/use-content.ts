"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SeoMetadata } from "@/lib/seo";

export function useContent(workspace: string, params?: { limit?: number; offset?: number; status?: string; type?: string }) {
  return useQuery({
    queryKey: ["content", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.status) sp.set("status", params.status);
      if (params?.type) sp.set("type", params.type);
      const res = await fetch(`/api/content?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch content");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const res = await fetch(`/api/content/${id}`);
      if (!res.ok) throw new Error("Failed to fetch post");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; markdown?: string; status?: string }) => {
      const res = await fetch(`/api/content/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["post", vars.id] });
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  });
}

export function useSeoData(postId: string) {
  return useQuery({
    queryKey: ["seo", postId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/seo`);
      if (!res.ok) throw new Error("Failed to fetch SEO data");
      return res.json();
    },
    enabled: !!postId,
  });
}

export function useGenerateSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId }: { postId: string }) => {
      const res = await fetch(`/api/content/${postId}/seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) throw new Error("SEO generation failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["seo", vars.postId] });
    },
  });
}

export function useSaveSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, ...data }: { postId: string } & Partial<SeoMetadata>) => {
      const res = await fetch(`/api/content/${postId}/seo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("SEO save failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["seo", vars.postId] });
    },
  });
}
