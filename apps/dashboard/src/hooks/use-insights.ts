"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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

/** SSE event from the insight extraction agent stream. */
export type ExtractEvent =
  | { type: "status"; phase: string; message: string }
  | { type: "tool_use"; tool: string; input?: unknown }
  | { type: "tool_result"; tool: string; result?: unknown }
  | { type: "text"; content: string }
  | { type: "complete"; message: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function useExtractInsights(workspace: string) {
  const qc = useQueryClient();
  const [isExtracting, setIsExtracting] = useState(false);
  const [events, setEvents] = useState<ExtractEvent[]>([]);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mutate = useCallback((sessionIds: string[]) => {
    setIsExtracting(true);
    setEvents([]);
    setStreamText("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    fetch("/api/insights/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug: workspace, sessionIds }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          const errBody = await res.text().catch(() => "");
          setError(`HTTP ${res.status}: ${errBody}`);
          setIsExtracting(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            // Parse SSE format: "event: <type>\ndata: <payload>"
            const lines = chunk.trim().split("\n");
            let eventType = "";
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7);
              else if (line.startsWith("data: ")) dataStr = line.slice(6);
            }

            if (eventType === "done") {
              setIsExtracting(false);
              qc.invalidateQueries({ queryKey: ["insights"] });
              continue;
            }

            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              const event: ExtractEvent = { type: eventType as ExtractEvent["type"], ...data };
              setEvents((prev) => [...prev, event]);

              if (eventType === "text" && data.content) {
                setStreamText((prev) => prev + data.content);
              }

              if (eventType === "error") {
                setError(data.message ?? "Agent error");
                setIsExtracting(false);
                qc.invalidateQueries({ queryKey: ["insights"] });
              }

              if (eventType === "complete") {
                setIsExtracting(false);
                qc.invalidateQueries({ queryKey: ["insights"] });
              }
            } catch {
              // skip malformed
            }
          }
        }
        setIsExtracting(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setError(err?.message ?? "Stream failed");
        }
        setIsExtracting(false);
      });
  }, [workspace, qc]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsExtracting(false);
  }, []);

  return {
    mutate,
    cancel,
    isPending: isExtracting,
    isExtracting,
    events,
    streamText,
    error,
  };
}
