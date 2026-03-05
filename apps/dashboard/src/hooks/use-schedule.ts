"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
      scheduledFor: string; // ISO 8601 date string in UTC
      timezone: string;
      platforms: string[];
    }) => {
      const res = await fetch("/api/scheduling/schedule", {
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
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useUnschedulePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, workspaceSlug }: { postId: string; workspaceSlug: string }) => {
      const res = await fetch("/api/scheduling/unschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, workspaceSlug }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to unschedule post");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });
}
