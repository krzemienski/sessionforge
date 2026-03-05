"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export type BatchJobResult = {
  jobId: string;
  status: string;
  totalItems: number;
};

export function useExtractInsightsBatch(workspace: string) {
  const qc = useQueryClient();
  return useMutation<BatchJobResult, Error, string[]>({
    mutationFn: async (sessionIds: string[]) => {
      const res = await fetch("/api/sessions/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "extract_insights",
          sessionIds,
          workspaceSlug: workspace,
        }),
      });
      if (!res.ok) throw new Error("Failed to start batch extract insights");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });
}

export type GenerateContentBatchParams = {
  insightIds: string[];
  contentType?: string;
};

export function useGenerateContentBatch(workspace: string) {
  const qc = useQueryClient();
  return useMutation<BatchJobResult, Error, GenerateContentBatchParams>({
    mutationFn: async ({ insightIds, contentType = "blog_post" }: GenerateContentBatchParams) => {
      const res = await fetch("/api/insights/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "generate_content",
          insightIds,
          contentType,
          workspaceSlug: workspace,
        }),
      });
      if (!res.ok) throw new Error("Failed to start batch generate content");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useArchivePostsBatch(workspace: string) {
  const qc = useQueryClient();
  return useMutation<BatchJobResult, Error, string[]>({
    mutationFn: async (postIds: string[]) => {
      const res = await fetch("/api/posts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "archive",
          postIds,
          workspaceSlug: workspace,
        }),
      });
      if (!res.ok) throw new Error("Failed to start batch archive posts");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useDeletePostsBatch(workspace: string) {
  const qc = useQueryClient();
  return useMutation<BatchJobResult, Error, string[]>({
    mutationFn: async (postIds: string[]) => {
      const res = await fetch("/api/posts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "delete",
          postIds,
          workspaceSlug: workspace,
        }),
      });
      if (!res.ok) throw new Error("Failed to start batch delete posts");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function usePublishPostsBatch(workspace: string) {
  const qc = useQueryClient();
  return useMutation<BatchJobResult, Error, string[]>({
    mutationFn: async (postIds: string[]) => {
      const res = await fetch("/api/posts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "publish",
          postIds,
          workspaceSlug: workspace,
        }),
      });
      if (!res.ok) throw new Error("Failed to start batch publish posts");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}
