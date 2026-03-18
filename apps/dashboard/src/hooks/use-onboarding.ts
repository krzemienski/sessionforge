"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type ScanResult = {
  scanned: number;
  indexed: number;
  errors: number;
  durationMs: number;
};

type ScanStatus = "idle" | "scanning" | "complete" | "error";

type ScanState = {
  status: ScanStatus;
  progress: number;
  totalFiles: number;
  currentFile: string;
  result: ScanResult | null;
  error: string | null;
};

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding");
      if (!res.ok) throw new Error("Failed to fetch onboarding status");
      return res.json() as Promise<{
        completed: boolean;
        hasWorkspace: boolean;
        workspaceSlug: string | null;
      }>;
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to complete onboarding");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useOnboardingScan() {
  const [state, setState] = useState<ScanState>({
    status: "idle",
    progress: 0,
    totalFiles: 0,
    currentFile: "",
    result: null,
    error: null,
  });

  const startScan = useCallback(
    async (_workspaceSlug: string, lookbackDays = 30) => {
      setState({
        status: "scanning",
        progress: 0,
        totalFiles: 0,
        currentFile: "",
        result: null,
        error: null,
      });

      try {
        const sp = new URLSearchParams({ lookbackDays: String(lookbackDays) });
        const res = await fetch(`/api/sessions/scan/stream?${sp}`);

        if (!res.ok || !res.body) {
          throw new Error("Failed to start scan stream");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            const data = JSON.parse(part.slice(6));

            if (data.type === "start") {
              setState((prev) => ({ ...prev, totalFiles: data.total }));
            } else if (data.type === "progress") {
              setState((prev) => ({
                ...prev,
                progress: data.current,
                totalFiles: data.total,
                currentFile: data.projectPath ?? data.sessionId ?? "",
              }));
            } else if (data.type === "complete") {
              setState({
                status: "complete",
                progress: data.scanned,
                totalFiles: data.scanned,
                currentFile: "",
                result: {
                  scanned: data.scanned,
                  indexed: (data.new ?? 0) + (data.updated ?? 0),
                  errors: data.errors,
                  durationMs: data.durationMs,
                },
                error: null,
              });
            } else if (data.type === "error") {
              setState((prev) => ({
                ...prev,
                status: "error",
                error: data.message,
              }));
            }
          }
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Scan failed",
        }));
      }
    },
    []
  );

  return { ...state, startScan };
}

export function useTrackOnboardingStep() {
  const trackStep = useCallback(
    (step: string, event: string, metadata?: Record<string, unknown>) => {
      // Fire-and-forget: don't await, don't block UI
      fetch("/api/onboarding/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, event, metadata }),
      }).catch(() => {
        // Silently fail - funnel tracking should never block user experience
      });
    },
    []
  );

  return trackStep;
}
