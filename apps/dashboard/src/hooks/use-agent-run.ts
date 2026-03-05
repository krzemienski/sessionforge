"use client";

import { useState, useCallback, useRef } from "react";

export type AgentRunStatus = "idle" | "running" | "retrying" | "completed" | "failed";

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  isRateLimit: boolean;
  message: string;
}

export interface AgentRunState {
  status: AgentRunStatus;
  retryInfo: RetryInfo | null;
  error: string | null;
  canRetry: boolean;
}

export interface AgentRunHandle<P> {
  status: AgentRunStatus;
  retryInfo: RetryInfo | null;
  error: string | null;
  canRetry: boolean;
  run: (payload: P) => Promise<void>;
  retry: () => void;
}

/**
 * Hook for consuming an SSE agent endpoint with retry state tracking.
 * Parses server-sent events from the backend streaming agents and exposes
 * structured state for progress, retry info, errors, and retry capability.
 */
export function useAgentRun<P extends Record<string, unknown>>(
  endpoint: string
): AgentRunHandle<P> {
  const [state, setState] = useState<AgentRunState>({
    status: "idle",
    retryInfo: null,
    error: null,
    canRetry: false,
  });

  const lastPayloadRef = useRef<P | null>(null);

  const run = useCallback(
    async (payload: P) => {
      lastPayloadRef.current = payload;

      setState({ status: "running", retryInfo: null, error: null, canRetry: false });

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = (body as { error?: string }).error ?? `Request failed: ${response.status}`;
          setState({ status: "failed", retryInfo: null, error: message, canRetry: true });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setState({ status: "failed", retryInfo: null, error: "No response stream", canRetry: true });
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
                setState({
                  status: "retrying",
                  retryInfo: parsed as unknown as RetryInfo,
                  error: null,
                  canRetry: false,
                });
                break;

              case "complete":
                setState({ status: "completed", retryInfo: null, error: null, canRetry: false });
                break;

              case "error":
                setState({
                  status: "failed",
                  retryInfo: null,
                  error: (parsed.message as string) ?? "Unknown error",
                  canRetry: true,
                });
                break;

              default:
                // status, tool_use, tool_result, text — keep running state
                if (state.status !== "retrying") {
                  setState((prev) =>
                    prev.status === "running" || prev.status === "retrying"
                      ? { ...prev, status: "running" }
                      : prev
                  );
                }
                break;
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "failed", retryInfo: null, error: message, canRetry: true });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint]
  );

  const retry = useCallback(() => {
    const payload = lastPayloadRef.current;
    if (payload) {
      run(payload);
    }
  }, [run]);

  return {
    status: state.status,
    retryInfo: state.retryInfo,
    error: state.error,
    canRetry: state.canRetry,
    run,
    retry,
  };
}
