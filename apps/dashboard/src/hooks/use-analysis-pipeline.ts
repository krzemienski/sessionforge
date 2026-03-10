"use client";

/**
 * React hook for managing pipeline analysis via SSE streaming.
 * Handles connection to /api/pipeline/analyze, parses events,
 * and maintains UI state (current stage, results, errors).
 */

import { useState, useCallback, useRef } from "react";

/**
 * Event emitted by the pipeline during streaming.
 * @property {string} stage - Current pipeline stage.
 * @property {string} message - Human-readable status message.
 * @property {string} [runId] - Unique run identifier.
 * @property {Record<string, unknown>} [data] - Metadata (counts, timings, IDs).
 */
export interface PipelineEvent {
  stage: "scanning" | "extracting" | "generating" | "complete" | "failed";
  message: string;
  runId?: string;
  data?: Record<string, unknown>;
}

/**
 * Internal state for the analysis pipeline hook.
 * @property {PipelineEvent[]} events - All events received so far.
 * @property {string | null} currentStage - Current active stage.
 * @property {boolean} isRunning - Whether pipeline is actively running.
 * @property {string | null} error - Error message if pipeline failed.
 * @property {string | null} runId - Unique identifier for this run.
 * @property {Object | null} result - Final results when complete (scanned, extracted, duration, postId).
 */
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

/**
 * Hook for initiating and monitoring pipeline analysis runs.
 *
 * @param workspaceSlug - The workspace slug to analyze.
 * @returns {Object} Object with state and control functions.
 * @returns {PipelineEvent[]} events - All events received during execution.
 * @returns {string | null} currentStage - Current pipeline stage.
 * @returns {boolean} isRunning - Whether analysis is in progress.
 * @returns {string | null} error - Error message if failed.
 * @returns {string | null} runId - Unique run identifier.
 * @returns {Object | null} result - Final results (null until complete).
 * @returns {Function} startAnalysis - Initiates analysis; accepts optional lookbackDays.
 * @returns {Function} cancel - Aborts the current run.
 *
 * @example
 * const { isRunning, currentStage, error, result, startAnalysis, cancel } = useAnalysisPipeline("my-workspace");
 * return (
 *   <>
 *     <button onClick={() => startAnalysis(30)}>Start (30 days)</button>
 *     <button onClick={cancel} disabled={!isRunning}>Cancel</button>
 *     {isRunning && <p>Stage: {currentStage}</p>}
 *     {result && <p>Created {result.insightsExtracted} insights</p>}
 *   </>
 * );
 */
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

  /**
   * Initiates pipeline analysis via SSE streaming.
   * Aborts any existing connection, resets state, and connects to /api/pipeline/analyze.
   * Progress events update state as they arrive; on completion or error, isRunning is set to false.
   *
   * @param {number} [lookbackDays=90] - Number of days to scan for sessions.
   */
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

  /**
   * Cancels the running pipeline analysis.
   * Aborts the SSE connection and marks pipeline as not running.
   */
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
