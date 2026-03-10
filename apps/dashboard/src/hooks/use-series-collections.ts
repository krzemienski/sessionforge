"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface GroupItem {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  isPublic: boolean;
  postCount: number;
  seriesPosts?: { post: { id: string } }[];
  collectionPosts?: { post: { id: string } }[];
}

export function useSeries(workspace: string) {
  return useQuery<{ series: GroupItem[] }>({
    queryKey: ["series", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/series?workspace=${workspace}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch series");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useCollections(workspace: string) {
  return useQuery<{ collections: GroupItem[] }>({
    queryKey: ["collections", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/collections?workspace=${workspace}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch collections");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useCreateSeries(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; slug: string; description?: string }) => {
      const res = await fetch(`/api/series?workspace=${workspace}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create series");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["series", workspace] }),
  });
}

export function useCreateCollection(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; slug: string; description?: string }) => {
      const res = await fetch(`/api/collections?workspace=${workspace}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create collection");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", workspace] }),
  });
}

export function useDeleteSeries(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/series/${id}?workspace=${workspace}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete series");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["series", workspace] }),
  });
}

export function useDeleteCollection(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/collections/${id}?workspace=${workspace}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete collection");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", workspace] }),
  });
}
