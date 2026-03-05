"use client";

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";

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

export function useSessionMessages(id: string) {
  return useInfiniteQuery({
    queryKey: ["session-messages", id],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const sp = new URLSearchParams({ limit: "50", offset: String(pageParam) });
      const res = await fetch(`/api/sessions/${id}/messages?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<{ messages: unknown[]; offset: number; limit: number; hasMore: boolean }>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: { hasMore: boolean; offset: number; limit: number }) =>
      lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined,
    enabled: !!id,
  });
}

export function useSessionBookmarks(id: string) {
  return useQuery({
    queryKey: ["bookmarks", id],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${id}/bookmarks`);
      if (!res.ok) throw new Error("Failed to fetch bookmarks");
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

/** Progress event from the SSE scan stream. */
export type ScanProgressEvent =
  | { type: "start"; total: number }
  | { type: "progress"; current: number; total: number; sessionId: string; projectPath: string }
  | { type: "complete"; scanned: number; new: number; updated: number; errors: string[]; durationMs: number }
  | { type: "error"; message: string };

/** Hook that streams scan progress via SSE for real-time UI updates. */
export function useStreamingScan(workspace: string) {
  const qc = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [events, setEvents] = useState<ScanProgressEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const startScan = useCallback((opts?: ScanOptions) => {
    const { lookbackDays = 30 } = opts ?? {};
    setIsScanning(true);
    setProgress(null);
    setEvents([]);

    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({
      lookbackDays: String(lookbackDays),
      workspaceSlug: workspace,
    });

    fetch(`/api/sessions/scan/stream?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          setProgress({ type: "error", message: `HTTP ${res.status}` });
          setIsScanning(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const chunk of lines) {
            const dataLine = chunk.trim().replace(/^data:\s*/, "");
            if (!dataLine) continue;
            try {
              const event = JSON.parse(dataLine) as ScanProgressEvent;
              setProgress(event);
              setEvents((prev) => [...prev, event]);
              if (event.type === "complete" || event.type === "error") {
                setIsScanning(false);
                qc.invalidateQueries({ queryKey: ["sessions"] });
              }
            } catch { /* skip malformed */ }
          }
        }
        setIsScanning(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setProgress({ type: "error", message: err?.message ?? "Stream failed" });
        }
        setIsScanning(false);
      });
  }, [workspace, qc]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsScanning(false);
  }, []);

  return { isScanning, progress, events, startScan, cancel };
}
