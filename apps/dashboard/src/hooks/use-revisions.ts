"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useRevisions(postId: string) {
  return useQuery({
    queryKey: ["revisions", postId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/revisions`);
      if (!res.ok) throw new Error("Failed to fetch revisions");
      return res.json();
    },
    enabled: !!postId,
  });
}

export function useRevision(postId: string, revisionId: string) {
  return useQuery({
    queryKey: ["revision", postId, revisionId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/revisions/${revisionId}`);
      if (!res.ok) throw new Error("Failed to fetch revision");
      return res.json();
    },
    enabled: !!postId && !!revisionId,
  });
}

export function useRevisionDiff(postId: string, fromId: string | null, toId: string | null) {
  return useQuery({
    queryKey: ["revision-diff", postId, fromId, toId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/revisions/diff?from=${fromId}&to=${toId}`);
      if (!res.ok) throw new Error("Failed to fetch revision diff");
      return res.json();
    },
    enabled: !!postId && !!fromId && !!toId,
  });
}

export function useRestoreRevision(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (revisionId: string) => {
      const res = await fetch(`/api/content/${postId}/revisions/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });
      if (!res.ok) throw new Error("Restore failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post", postId] });
      qc.invalidateQueries({ queryKey: ["revisions", postId] });
    },
  });
}
