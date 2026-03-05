"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useMediumIntegration(workspace: string) {
  return useQuery({
    queryKey: ["medium-integration", workspace],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/integrations/medium?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch Medium integration status");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useConnectMedium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceSlug, apiKey }: { workspaceSlug: string; apiKey: string }) => {
      const res = await fetch("/api/integrations/medium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, apiKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to connect Medium account");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["medium-integration", vars.workspaceSlug] });
    },
  });
}

export function useDisconnectMedium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workspace: string) => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/integrations/medium?${sp}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect Medium account");
      return res.json();
    },
    onSuccess: (_, workspace) => {
      qc.invalidateQueries({ queryKey: ["medium-integration", workspace] });
    },
  });
}

export function useMediumPublication(postId: string, workspace: string) {
  return useQuery({
    queryKey: ["medium-publication", postId],
    queryFn: async () => {
      const sp = new URLSearchParams({ postId, workspace });
      const res = await fetch(`/api/integrations/medium/publish?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch Medium publication status");
      return res.json();
    },
    enabled: !!postId && !!workspace,
  });
}

export function usePublishToMedium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      workspaceSlug,
      publishStatus,
      tags,
      canonicalUrl,
      notifyFollowers,
    }: {
      postId: string;
      workspaceSlug: string;
      publishStatus?: "public" | "draft" | "unlisted";
      tags?: string[];
      canonicalUrl?: string;
      notifyFollowers?: boolean;
    }) => {
      const res = await fetch("/api/integrations/medium/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, workspaceSlug, publishStatus, tags, canonicalUrl, notifyFollowers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to publish to Medium");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["medium-publication", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });
}

export function useUpdateMediumPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      workspaceSlug,
      publishStatus,
      tags,
      canonicalUrl,
      notifyFollowers,
    }: {
      postId: string;
      workspaceSlug: string;
      publishStatus?: "public" | "draft" | "unlisted";
      tags?: string[];
      canonicalUrl?: string;
      notifyFollowers?: boolean;
    }) => {
      const res = await fetch("/api/integrations/medium/publish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, workspaceSlug, publishStatus, tags, canonicalUrl, notifyFollowers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update Medium post");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["medium-publication", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });
}
