"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useVerification(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}) => {
      const res = await fetch(`/api/content/${postId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) throw new Error("Verification failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk-flags", postId] });
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
}
