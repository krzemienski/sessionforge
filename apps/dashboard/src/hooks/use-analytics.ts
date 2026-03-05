"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type AnalyticsWindow = 7 | 30 | 90;

export function useAnalyticsMetrics(
  workspace: string,
  params?: { window?: AnalyticsWindow; platform?: string }
) {
  return useQuery({
    queryKey: ["analytics", "metrics", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.window) sp.set("window", String(params.window));
      if (params?.platform) sp.set("platform", params.platform);
      const res = await fetch(`/api/analytics/metrics?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch analytics metrics");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useSyncMetrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/analytics/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics", "metrics"] }),
  });
}

export function usePlatformSettings(workspace: string) {
  return useQuery({
    queryKey: ["analytics", "platform-settings", workspace],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/analytics/platform-settings?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch platform settings");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useSavePlatformSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceSlug: string;
      devtoApiKey?: string | null;
      devtoUsername?: string | null;
      hashnodeApiKey?: string | null;
      hashnodeUsername?: string | null;
    }) => {
      const res = await fetch("/api/analytics/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save platform settings");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["analytics", "platform-settings", vars.workspaceSlug],
      });
    },
  });
}
