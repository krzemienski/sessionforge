"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useIntegrations(workspace: string) {
  return useQuery({
    queryKey: ["integrations", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/integrations`);
      if (!res.ok) throw new Error("Failed to fetch integrations");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useUpdateIntegrations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspace,
      ...data
    }: {
      workspace: string;
      hashnodeToken?: string;
      hashnodePublicationId?: string;
      hashnodeDefaultCanonicalDomain?: string;
    }) => {
      const res = await fetch(`/api/workspace/${workspace}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update integrations");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["integrations", vars.workspace] });
    },
  });
}
