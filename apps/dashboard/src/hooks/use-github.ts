"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useGitHubActivity(workspace: string, params?: { limit?: number }) {
  return useQuery({
    queryKey: ["github-activity", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      const res = await fetch(`/api/integrations/github/activity?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch GitHub activity");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useGitHubPrivacyExclusions(workspace: string) {
  return useQuery({
    queryKey: ["github-privacy-exclusions", workspace],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/integrations/github/privacy?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch privacy exclusions");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useExcludeFromContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      workspace: string;
      repositoryId?: string;
      commitSha?: string;
    }) => {
      const res = await fetch("/api/integrations/github/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: params.workspace,
          repositoryId: params.repositoryId,
          commitSha: params.commitSha,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to exclude item");
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate activity and exclusions queries to refetch
      queryClient.invalidateQueries({ queryKey: ["github-activity", variables.workspace] });
      queryClient.invalidateQueries({ queryKey: ["github-privacy-exclusions", variables.workspace] });
    },
  });
}

export function useIncludeInContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { workspace: string; exclusionId: string }) => {
      const sp = new URLSearchParams({
        workspace: params.workspace,
        exclusionId: params.exclusionId,
      });
      const res = await fetch(`/api/integrations/github/privacy?${sp}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to include item");
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate activity and exclusions queries to refetch
      queryClient.invalidateQueries({ queryKey: ["github-activity", variables.workspace] });
      queryClient.invalidateQueries({ queryKey: ["github-privacy-exclusions", variables.workspace] });
    },
  });
}
