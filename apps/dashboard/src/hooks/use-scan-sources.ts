"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ScanSource {
  id: string;
  label: string;
  host: string;
  port: number | null;
  username: string;
  encryptedPassword: string;
  basePath: string | null;
  enabled: boolean | null;
  lastScannedAt: string | null;
  createdAt: string | null;
}

export function useScanSources(workspace: string) {
  const query = useQuery({
    queryKey: ["scan-sources", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/scan-sources?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return {
    sources: (query.data?.sources ?? []) as ScanSource[],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateScanSource(workspace: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      label: string;
      host: string;
      port?: number;
      username: string;
      password: string;
      basePath?: string;
    }) => {
      const res = await fetch("/api/scan-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, ...values }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create source");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-sources", workspace] }),
  });
}

export function useDeleteScanSource(workspace: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/scan-sources/${id}?workspace=${workspace}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete source");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-sources", workspace] }),
  });
}

export function useUpdateScanSource(workspace: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/scan-sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, ...values }),
      });
      if (!res.ok) throw new Error("Failed to update source");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-sources", workspace] }),
  });
}

export function useCheckScanSource(workspace: string) {
  const [checkResult, setCheckResult] = useState<{
    success: boolean;
    message?: string;
    sessionsFound?: number;
    error?: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/scan-sources/${id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace }),
      });
      return res.json();
    },
    onSuccess: (data) => setCheckResult(data),
    onError: () =>
      setCheckResult({ success: false, error: "Connection check failed" }),
  });

  return {
    check: mutation.mutate,
    isChecking: mutation.isPending,
    checkResult,
    clearResult: () => setCheckResult(null),
  };
}
