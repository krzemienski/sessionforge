"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useSessions(workspace: string, params?: { limit?: number; offset?: number; sort?: string; project?: string; dateFrom?: string; dateTo?: string; minMessages?: number; maxMessages?: number; hasSummary?: boolean }) {
  return useQuery({
    queryKey: ["sessions", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.sort) sp.set("sort", params.sort);
      if (params?.project) sp.set("project", params.project);
      if (params?.dateFrom) sp.set("dateFrom", params.dateFrom);
      if (params?.dateTo) sp.set("dateTo", params.dateTo);
      if (params?.minMessages) sp.set("minMessages", String(params.minMessages));
      if (params?.maxMessages) sp.set("maxMessages", String(params.maxMessages));
      if (params?.hasSummary !== undefined) sp.set("hasSummary", String(params.hasSummary));
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

export function useSessionMessages(id: string, params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["session-messages", id, params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      const res = await fetch(`/api/sessions/${id}/messages?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!id,
  });
}

export type ScanOptions = {
  lookbackDays?: number;
  fullRescan?: boolean;
};

export type ScanResult = {
  scanned: number;
  new: number;
  updated: number;
  errors: string[];
  durationMs: number;
  isIncremental: boolean;
  lastScanAt: string;
};

export function useScanSessions(workspace: string) {
  const qc = useQueryClient();
  return useMutation<ScanResult, Error, ScanOptions | number>({
    mutationFn: async (options: ScanOptions | number = 30) => {
      const opts: ScanOptions =
        typeof options === "number" ? { lookbackDays: options } : options;
      const { lookbackDays = 30, fullRescan = false } = opts;
      const res = await fetch("/api/sessions/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, lookbackDays, fullRescan }),
      });
      if (!res.ok) throw new Error("Scan failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}
