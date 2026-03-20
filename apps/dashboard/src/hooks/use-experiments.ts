"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useExperiments(workspace: string, postId?: string) {
  return useQuery({
    queryKey: ["experiments", workspace, postId],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (postId) sp.set("postId", postId);
      const res = await fetch(`/api/experiments?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch experiments");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useExperiment(experimentId: string) {
  return useQuery({
    queryKey: ["experiment", experimentId],
    queryFn: async () => {
      const res = await fetch(`/api/experiments/${experimentId}`);
      if (!res.ok) throw new Error("Failed to fetch experiment");
      return res.json();
    },
    enabled: !!experimentId,
  });
}

export function useCreateExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceSlug: string;
      postId: string;
      name: string;
      kpi: string;
      startsAt?: string;
      endsAt?: string;
      variants: {
        label: string;
        headlineText?: string;
        hookText?: string;
        trafficAllocation: number;
        isControl?: boolean;
      }[];
    }) => {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create experiment");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["experiments", vars.workspaceSlug] });
    },
  });
}

export function useUpdateExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      kpi?: string;
      status?: string;
      startsAt?: string;
      endsAt?: string;
    }) => {
      const res = await fetch(`/api/experiments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update experiment");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["experiment", vars.id] });
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
}

export function useDeleteExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/experiments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete experiment");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
}
