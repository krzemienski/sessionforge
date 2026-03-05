"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useSessionBookmarks(sessionId: string) {
  return useQuery({
    queryKey: ["bookmarks", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/bookmarks`);
      if (!res.ok) throw new Error("Failed to fetch bookmarks");
      return res.json();
    },
    enabled: !!sessionId,
  });
}

export function useCreateBookmark(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { messageIndex: number; label?: string; note?: string }) => {
      const res = await fetch(`/api/sessions/${sessionId}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create bookmark");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks", sessionId] }),
  });
}

export function useDeleteBookmark(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookmarkId: string) => {
      const res = await fetch(`/api/sessions/${sessionId}/bookmarks/${bookmarkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete bookmark");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks", sessionId] }),
  });
}
