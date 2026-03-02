"use client";

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useSessions(workspace: string, params?: { limit?: number; offset?: number; sort?: string; project?: string }) {
  return useQuery({
    queryKey: ["sessions", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.sort) sp.set("sort", params.sort);
      if (params?.project) sp.set("project", params.project);
      const res = await fetch(`/api/sessions?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useSessionMessages(id: string) {
  return useInfiniteQuery({
    queryKey: ["session-messages", id],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const sp = new URLSearchParams({ limit: "50", offset: String(pageParam) });
      const res = await fetch(`/api/sessions/${id}/messages?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<{ messages: unknown[]; offset: number; limit: number; hasMore: boolean }>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: { hasMore: boolean; offset: number; limit: number }) =>
      lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined,
    enabled: !!id,
  });
}

export function useSessionBookmarks(id: string) {
  return useQuery({
    queryKey: ["bookmarks", id],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${id}/bookmarks`);
      if (!res.ok) throw new Error("Failed to fetch bookmarks");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useScanSessions(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lookbackDays: number = 30) => {
      const res = await fetch("/api/sessions/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, lookbackDays }),
      });
      if (!res.ok) throw new Error("Scan failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}
