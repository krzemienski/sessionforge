"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useGhostIntegration(workspace: string) {
  return useQuery({
    queryKey: ["ghost-integration", workspace],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/integrations/ghost?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch Ghost integration status");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useConnectGhost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceSlug,
      apiUrl,
      adminApiKey,
    }: {
      workspaceSlug: string;
      apiUrl: string;
      adminApiKey: string;
    }) => {
      const res = await fetch("/api/integrations/ghost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, apiUrl, adminApiKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to connect Ghost account");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["ghost-integration", vars.workspaceSlug] });
    },
  });
}

export function useDisconnectGhost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workspace: string) => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/integrations/ghost?${sp}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect Ghost account");
      return res.json();
    },
    onSuccess: (_, workspace) => {
      qc.invalidateQueries({ queryKey: ["ghost-integration", workspace] });
    },
  });
}

export function useGhostPublication(postId: string, workspace: string) {
  return useQuery({
    queryKey: ["ghost-publication", postId],
    queryFn: async () => {
      const sp = new URLSearchParams({ postId, workspace });
      const res = await fetch(`/api/integrations/ghost/publish?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch Ghost publication status");
      return res.json();
    },
    enabled: !!postId && !!workspace,
  });
}

export function usePublishToGhost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      workspaceSlug,
      status,
      tags,
      canonicalUrl,
      excerpt,
    }: {
      postId: string;
      workspaceSlug: string;
      status?: "draft" | "published";
      tags?: string[];
      canonicalUrl?: string;
      excerpt?: string;
    }) => {
      const res = await fetch("/api/integrations/ghost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, workspaceSlug, status, tags, canonicalUrl, excerpt }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to publish to Ghost");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["ghost-publication", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });
}

export function useUpdateGhostPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      workspaceSlug,
      status,
      tags,
      canonicalUrl,
      excerpt,
    }: {
      postId: string;
      workspaceSlug: string;
      status?: "draft" | "published";
      tags?: string[];
      canonicalUrl?: string;
      excerpt?: string;
    }) => {
      const res = await fetch("/api/integrations/ghost/publish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, workspaceSlug, status, tags, canonicalUrl, excerpt }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update Ghost post");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["ghost-publication", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });
}
