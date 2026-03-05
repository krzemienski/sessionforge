"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useScheduledPosts(workspace: string) {
  return useQuery({
    queryKey: ["scheduled-posts", workspace],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/schedule?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch scheduled posts");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useSchedulePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      workspaceSlug,
      scheduledFor,
      timezone,
      platforms,
    }: {
      postId: string;
      workspaceSlug: string;
      scheduledFor: string;
      timezone: string;
      platforms: string[];
    }) => {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, workspaceSlug, scheduledFor, timezone, platforms }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to schedule post");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["scheduled-posts", vars.workspaceSlug] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });
}

export function useReschedulePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      scheduledFor,
      timezone,
      platforms,
    }: {
      postId: string;
      scheduledFor: string;
      timezone?: string;
      platforms?: string[];
    }) => {
      const res = await fetch(`/api/schedule/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor, timezone, platforms }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to reschedule post");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });
}

export function useCancelSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/schedule/${postId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to cancel scheduled post");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
    },
  });
}

