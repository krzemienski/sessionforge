"use client";

import { useQuery } from "@tanstack/react-query";

export function useActivity(workspace: string, params?: { limit?: number }) {
  return useQuery({
    queryKey: ["activity", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      const res = await fetch(`/api/activity?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    enabled: !!workspace,
  });
}
