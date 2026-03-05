"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";

export function useInsights(workspace: string, params?: { limit?: number; offset?: number; minScore?: number; category?: string; sessionId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ["insights", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.minScore) sp.set("minScore", String(params.minScore));
      if (params?.category) sp.set("category", params.category);
      if (params?.sessionId) sp.set("sessionId", params.sessionId);
      if (params?.dateFrom) sp.set("dateFrom", params.dateFrom);
      if (params?.dateTo) sp.set("dateTo", params.dateTo);
      const res = await fetch(`/api/insights?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useInsight(id: string) {
  return useQuery({
    queryKey: ["insight", id],
    queryFn: async () => {
      const res = await fetch(`/api/insights/${id}`);
      if (!res.ok) throw new Error("Failed to fetch insight");
      return res.json();
    },
    enabled: !!id,
  });
}

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export function useExtractInsights(workspace: string) {
  const qc = useQueryClient();
  const [isExtracting, setIsExtracting] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mutate = useCallback(
    async (sessionIds: string[]) => {
      setIsExtracting(true);
      setEvents([]);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/insights/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceSlug: workspace, sessionIds }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Extraction failed");

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const evt = JSON.parse(line.slice(6)) as SSEEvent;
                  setEvents((prev) => [...prev, evt]);
                } catch {
                  // skip malformed lines
                }
              }
            }
          }
        }

        qc.invalidateQueries({ queryKey: ["insights"] });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setIsExtracting(false);
        abortRef.current = null;
      }
    },
    [workspace, qc]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    mutate,
    isExtracting,
    isPending: isExtracting,
    events,
    error,
    cancel,
  };
}
