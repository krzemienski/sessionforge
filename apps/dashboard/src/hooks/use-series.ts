"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useSeries(workspace: string, params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["series", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      const res = await fetch(`/api/series?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch series");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useSingleSeries(id: string) {
  return useQuery({
    queryKey: ["series", id],
    queryFn: async () => {
      const res = await fetch(`/api/series/${id}`);
      if (!res.ok) throw new Error("Failed to fetch series");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { workspace: string; title: string; description?: string; slug: string; coverImage?: string; isPublic?: boolean }) => {
      const res = await fetch(`/api/series?workspace=${data.workspace}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Create failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["series", vars.workspace] });
    },
  });
}

export function useUpdateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string; slug?: string; coverImage?: string; isPublic?: boolean }) => {
      const res = await fetch(`/api/series/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["series", vars.id] });
      qc.invalidateQueries({ queryKey: ["series"] });
    },
  });
}

export function useDeleteSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/series/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["series"] }),
  });
}

export function useAddPostToSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ seriesId, postId, position }: { seriesId: string; postId: string; position: number }) => {
      const res = await fetch(`/api/series/${seriesId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, position }),
      });
      if (!res.ok) throw new Error("Add post failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["series", vars.seriesId] });
      qc.invalidateQueries({ queryKey: ["series"] });
    },
  });
}

export function useRemovePostFromSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ seriesId, postId }: { seriesId: string; postId: string }) => {
      const res = await fetch(`/api/series/${seriesId}/posts?postId=${postId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Remove post failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["series", vars.seriesId] });
      qc.invalidateQueries({ queryKey: ["series"] });
    },
  });
}

export function useReorderSeriesPosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ seriesId, postIds }: { seriesId: string; postIds: string[] }) => {
      const res = await fetch(`/api/series/${seriesId}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds }),
      });
      if (!res.ok) throw new Error("Reorder failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["series", vars.seriesId] });
      qc.invalidateQueries({ queryKey: ["series"] });
    },
  });
}
