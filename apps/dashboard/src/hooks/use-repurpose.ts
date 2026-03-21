"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type TargetFormat = "twitter_thread" | "linkedin_post" | "changelog" | "tldr" | "blog_post" | "newsletter" | "doc_page";

export type AgentRunStatus = "idle" | "running" | "retrying" | "completed" | "failed";

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  isRateLimit: boolean;
  message: string;
}

export interface RepurposedVariant {
  id: string;
  title: string;
  contentType: string;
  status: string;
  createdAt: string;
}

export interface RepurposeData {
  variants: RepurposedVariant[];
  parentPost: RepurposedVariant | null;
}

export interface RepurposePayload {
  workspaceSlug: string;
  sourcePostId: string;
  targetFormat: TargetFormat;
  customInstructions?: string;
}

/**
 * Hook for fetching repurposed variants (parent and derived posts)
 */
export function useRepurposedVariants(postId: string) {
  return useQuery({
    queryKey: ["repurposed-variants", postId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/repurposed-variants`);
      if (!res.ok) throw new Error("Failed to fetch repurposed variants");
      return res.json() as Promise<RepurposeData>;
    },
    enabled: !!postId,
  });
}

/**
 * Hook for running the repurpose agent with SSE streaming and retry support.
 * Parses server-sent events from the backend streaming agent and exposes
 * structured state for progress, retry info, errors, and retry capability.
 */
export function useRepurpose() {
  const qc = useQueryClient();

  const [status, setStatus] = useState<AgentRunStatus>("idle");
  const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const lastPayloadRef = useRef<RepurposePayload | null>(null);

  const run = useCallback(
    async (payload: RepurposePayload) => {
      lastPayloadRef.current = payload;

      setStatus("running");
      setRetryInfo(null);
      setError(null);
      setCanRetry(false);

      try {
        const response = await fetch("/api/agents/repurpose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = (body as { error?: string }).error ?? `Request failed: ${response.status}`;
          setStatus("failed");
          setError(message);
          setCanRetry(true);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setStatus("failed");
          setError("No response stream");
          setCanRetry(true);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (separated by double newline)
          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";

          for (const message of messages) {
            if (!message.trim()) continue;

            let eventName = "message";
            let dataLine = "";

            for (const line of message.split("\n")) {
              if (line.startsWith("event: ")) {
                eventName = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                dataLine = line.slice(6).trim();
              }
            }

            if (!dataLine) continue;

            if (eventName === "done") {
              // Stream finished cleanly
              break;
            }

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(dataLine);
            } catch {
              continue;
            }

            switch (eventName) {
              case "retry_status":
                setStatus("retrying");
                setRetryInfo(parsed as unknown as RetryInfo);
                setError(null);
                setCanRetry(false);
                break;

              case "complete":
                setStatus("completed");
                setRetryInfo(null);
                setError(null);
                setCanRetry(false);
                // Invalidate queries to refresh data
                qc.invalidateQueries({ queryKey: ["repurposed-variants", payload.sourcePostId] });
                qc.invalidateQueries({ queryKey: ["content"] });
                break;

              case "error":
                setStatus("failed");
                setRetryInfo(null);
                setError((parsed.message as string) ?? "Unknown error");
                setCanRetry(true);
                break;

              default:
                // status, tool_use, tool_result, text — keep running state
                if (status !== "retrying") {
                  setStatus("running");
                }
                break;
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus("failed");
        setRetryInfo(null);
        setError(message);
        setCanRetry(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc]
  );

  const retry = useCallback(() => {
    const payload = lastPayloadRef.current;
    if (payload) {
      run(payload);
    }
  }, [run]);

  return {
    status,
    retryInfo,
    error,
    canRetry,
    run,
    retry,
  };
}
