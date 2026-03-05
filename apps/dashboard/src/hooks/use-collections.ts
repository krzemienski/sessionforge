"use client";

import { useState, useCallback } from "react";
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

export function useCollection(id: string) {
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
  const mutation = useMutation({
    mutationFn: async (data: {
      workspaceSlug: string;
      name: string;
      slug: string;
      description?: string;
      theme?: string;
      customDomain?: string;
    }) => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create collection");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const createCollection = useCallback(
    async (
      workspaceSlug: string,
      data: { name: string; slug: string; description?: string; theme?: string }
    ) => {
      return mutation.mutateAsync({ workspaceSlug, ...data });
    },
    [mutation]
  );

  return { createCollection, isCreating: mutation.isPending };
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      slug?: string;
      description?: string;
      theme?: string;
      customDomain?: string;
      poweredByFooter?: boolean;
    }) => {
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

export function useExportCollection() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCollection = useCallback(
    async (id: string, collectionName: string, theme?: string) => {
      setIsExporting(true);
      try {
        const sp = new URLSearchParams();
        if (theme) sp.set("theme", theme);
        const res = await fetch(`/api/collections/${id}/export?${sp}`);
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${collectionName.toLowerCase().replace(/\s+/g, "-")}-site.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return { exportCollection, isExporting };
}

export function useCollectionPosts(collectionId: string) {
  return useQuery({
    queryKey: ["collection-posts", collectionId],
    queryFn: async () => {
      const res = await fetch(`/api/collections/${collectionId}/posts`);
      if (!res.ok) throw new Error("Failed to fetch collection posts");
      return res.json();
    },
    enabled: !!collectionId,
  });
}

export function useAddPostToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, postId }: { collectionId: string; postId: string }) => {
      const res = await fetch(`/api/collections/${collectionId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) throw new Error("Failed to add post to collection");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collection-posts", vars.collectionId] });
    },
  });
}

export function useRemovePostFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, postId }: { collectionId: string; postId: string }) => {
      const res = await fetch(
        `/api/collections/${collectionId}/posts?postId=${postId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove post from collection");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["collection-posts", vars.collectionId] });
    },
  });
}
