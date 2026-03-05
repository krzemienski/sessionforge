"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useCollections(workspace: string, params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["collections", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      const res = await fetch(`/api/collections?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch collections");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useSingleCollection(id: string) {
  return useQuery({
    queryKey: ["collection", id],
    queryFn: async () => {
      const res = await fetch(`/api/collections/${id}`);
      if (!res.ok) throw new Error("Failed to fetch collection");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { workspace: string; title: string; description?: string; slug: string; coverImage?: string; isPublic?: boolean }) => {
      const res = await fetch(`/api/collections?workspace=${data.workspace}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Create failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collections", vars.workspace] });
    },
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string; slug?: string; coverImage?: string; isPublic?: boolean }) => {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collection", vars.id] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections"] }),
  });
}

export function useAddPostToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, postId, order }: { collectionId: string; postId: string; order?: number }) => {
      const res = await fetch(`/api/collections/${collectionId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, order }),
      });
      if (!res.ok) throw new Error("Add post failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collection", vars.collectionId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useRemovePostFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, postId }: { collectionId: string; postId: string }) => {
      const res = await fetch(`/api/collections/${collectionId}/posts?postId=${postId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Remove post failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collection", vars.collectionId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useReorderCollectionPosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, postIds }: { collectionId: string; postIds: string[] }) => {
      const res = await fetch(`/api/collections/${collectionId}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds }),
      });
      if (!res.ok) throw new Error("Reorder failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collection", vars.collectionId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}
