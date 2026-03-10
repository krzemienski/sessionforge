"use client";

import { useState, useCallback, useRef } from "react";

export interface PipelineEvent {
  stage: "scanning" | "extracting" | "generating" | "complete" | "failed";
  message: string;
  runId?: string;
  data?: Record<string, unknown>;
}

interface AnalysisPipelineState {
  events: PipelineEvent[];
  currentStage: PipelineEvent["stage"] | null;
  isRunning: boolean;
  error: string | null;
  runId: string | null;
  result: {
    sessionsScanned: number;
    insightsExtracted: number;
    durationMs: number;
    postId: string | null;
  } | null;
}

export function useAnalysisPipeline(workspaceSlug: string) {
  const [state, setState] = useState<AnalysisPipelineState>({
    events: [],
    currentStage: null,
    isRunning: false,
    error: null,
    runId: null,
    result: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const startAnalysis = useCallback(
    async (lookbackDays = 90) => {
      // Abort any existing connection
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        events: [],
        currentStage: "scanning",
        isRunning: true,
        error: null,
        runId: null,
        result: null,
      });

      try {
        const response = await fetch("/api/pipeline/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceSlug, lookbackDays }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const msg =
            (err as { error?: string }).error ??
            `Pipeline request failed (${response.status})`;
          setState((prev) => ({
            ...prev,
            isRunning: false,
            error: msg,
            currentStage: "failed",
          }));
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setState((prev) => ({
            ...prev,
            isRunning: false,
            error: "No response stream",
            currentStage: "failed",
          }));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as PipelineEvent;
              setState((prev) => {
                const newEvents = [...prev.events, event];
                const newState: AnalysisPipelineState = {
                  ...prev,
                  events: newEvents,
                  currentStage: event.stage,
                  runId: event.runId ?? prev.runId,
                };

                if (event.stage === "complete") {
                  newState.isRunning = false;
                  newState.result = {
                    sessionsScanned:
                      (event.data?.sessionsScanned as number) ?? 0,
                    insightsExtracted:
                      (event.data?.insightsExtracted as number) ?? 0,
                    durationMs: (event.data?.durationMs as number) ?? 0,
                    postId: (event.data?.postId as string) ?? null,
                  };
                } else if (event.stage === "failed") {
                  newState.isRunning = false;
                  newState.error = event.message;
                }

                return newState;
              });
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        // Stream ended — ensure we mark as not running
        setState((prev) =>
          prev.isRunning ? { ...prev, isRunning: false } : prev
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          isRunning: false,
          error: err instanceof Error ? err.message : String(err),
          currentStage: "failed",
        }));
      }
    },
    [workspaceSlug]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  return {
    ...state,
    startAnalysis,
    cancel,
  };
}
