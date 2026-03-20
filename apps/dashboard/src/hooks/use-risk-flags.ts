"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useRiskFlags(postId: string) {
  return useQuery({
    queryKey: ["risk-flags", postId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/risk-flags`);
      if (!res.ok) throw new Error("Failed to fetch risk flags");
      return res.json();
    },
    enabled: !!postId,
  });
}

export function useResolveFlag(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      flagId,
      status,
      evidenceNotes,
    }: {
      flagId: string;
      status: "verified" | "dismissed" | "overridden";
      evidenceNotes?: string;
    }) => {
      const res = await fetch(`/api/content/${postId}/risk-flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, evidenceNotes }),
      });
      if (!res.ok) throw new Error("Failed to resolve risk flag");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk-flags", postId] });
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
}
