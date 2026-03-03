"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useDevtoIntegration(workspace: string) {
  return useQuery({
    queryKey: ["devto-integration", workspace],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/integrations/devto?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch Dev.to integration status");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useConnectDevto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceSlug, apiKey }: { workspaceSlug: string; apiKey: string }) => {
      const res = await fetch("/api/integrations/devto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, apiKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to connect Dev.to account");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["devto-integration", vars.workspaceSlug] });
    },
  });
}

export function useDisconnectDevto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workspace: string) => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/integrations/devto?${sp}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect Dev.to account");
      return res.json();
    },
    onSuccess: (_, workspace) => {
      qc.invalidateQueries({ queryKey: ["devto-integration", workspace] });
    },
  });
}

export function useDevtoPublication(postId: string, workspace: string) {
  return useQuery({
    queryKey: ["devto-publication", postId],
    queryFn: async () => {
      const sp = new URLSearchParams({ postId, workspace });
      const res = await fetch(`/api/integrations/devto/publish?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch Dev.to publication status");
      return res.json();
    },
    enabled: !!postId && !!workspace,
  });
}

export function usePublishToDevto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      workspaceSlug,
      published,
      tags,
      canonicalUrl,
      series,
    }: {
      postId: string;
      workspaceSlug: string;
      published?: boolean;
      tags?: string[];
      canonicalUrl?: string;
      series?: string;
    }) => {
      const res = await fetch("/api/integrations/devto/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, workspaceSlug, published, tags, canonicalUrl, series }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to publish to Dev.to");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["devto-publication", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });
}

export function useUpdateDevtoPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      workspaceSlug,
      published,
      tags,
      canonicalUrl,
      series,
    }: {
      postId: string;
      workspaceSlug: string;
      published?: boolean;
      tags?: string[];
      canonicalUrl?: string;
      series?: string;
    }) => {
      const res = await fetch("/api/integrations/devto/publish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, workspaceSlug, published, tags, canonicalUrl, series }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update Dev.to article");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["devto-publication", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });
}
