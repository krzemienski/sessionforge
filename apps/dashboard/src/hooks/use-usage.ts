"use client";

import { useQuery } from "@tanstack/react-query";

export function useUsage(workspace: string) {
  return useQuery({
    queryKey: ["usage", workspace],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      const res = await fetch(`/api/usage?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
  });
}
