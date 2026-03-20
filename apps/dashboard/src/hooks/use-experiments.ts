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
        headlineText: string;
        hookText: string;
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

export function useAddVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      experimentId,
      ...data
    }: {
      experimentId: string;
      label: string;
      headlineText: string;
      hookText: string;
      trafficAllocation: number;
      isControl?: boolean;
    }) => {
      const res = await fetch(`/api/experiments/${experimentId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add variant");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["experiment", vars.experimentId] });
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      experimentId,
      variantId,
      ...data
    }: {
      experimentId: string;
      variantId: string;
      label?: string;
      headlineText?: string;
      hookText?: string;
      trafficAllocation?: number;
    }) => {
      const res = await fetch(
        `/api/experiments/${experimentId}/variants`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId, ...data }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update variant");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["experiment", vars.experimentId] });
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
}

export function useRemoveVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      experimentId,
      variantId,
    }: {
      experimentId: string;
      variantId: string;
    }) => {
      const res = await fetch(
        `/api/experiments/${experimentId}/variants?variantId=${variantId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to remove variant");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["experiment", vars.experimentId] });
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
}

export function useRecordResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      experimentId,
      variantId,
      ...data
    }: {
      experimentId: string;
      variantId: string;
      impressions?: number;
      clicks?: number;
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      engagementRate?: number;
    }) => {
      const res = await fetch(
        `/api/experiments/${experimentId}/results`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId, ...data }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to record results");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["experiment", vars.experimentId] });
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
}

export function useExperimentWinner(experimentId: string) {
  return useQuery({
    queryKey: ["experiment-winner", experimentId],
    queryFn: async () => {
      const res = await fetch(`/api/experiments/${experimentId}/winner`);
      if (!res.ok) throw new Error("Failed to fetch winner suggestion");
      return res.json();
    },
    enabled: !!experimentId,
  });
}

export function usePromoteWinner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      experimentId,
      variantId,
    }: {
      experimentId: string;
      variantId: string;
    }) => {
      const res = await fetch(
        `/api/experiments/${experimentId}/promote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to promote winner");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["experiment", vars.experimentId] });
      qc.invalidateQueries({ queryKey: ["experiment-winner", vars.experimentId] });
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
}
