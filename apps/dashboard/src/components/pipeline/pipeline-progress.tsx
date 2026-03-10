"use client";

import {
  Search,
  Brain,
  PenTool,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineEvent } from "@/hooks/use-analysis-pipeline";

interface PipelineProgressProps {
  events: PipelineEvent[];
  currentStage: PipelineEvent["stage"] | null;
  isRunning: boolean;
  error: string | null;
  result: {
    sessionsScanned: number;
    insightsExtracted: number;
    durationMs: number;
    postId: string | null;
  } | null;
}

const STAGE_META = [
  { key: "scanning" as const, label: "Scanning Sessions", icon: Search },
  { key: "extracting" as const, label: "Extracting Insights", icon: Brain },
  { key: "generating" as const, label: "Generating Content", icon: PenTool },
] as const;

function stageState(
  stageKey: string,
  currentStage: string | null,
  isRunning: boolean
): "pending" | "active" | "done" | "failed" {
  if (!currentStage) return "pending";
  if (currentStage === "failed") return "failed";
  if (currentStage === "complete") return "done";

  const order = ["scanning", "extracting", "generating"];
  const currentIdx = order.indexOf(currentStage);
  const stageIdx = order.indexOf(stageKey);

  if (stageIdx < currentIdx) return "done";
  if (stageIdx === currentIdx) return isRunning ? "active" : "done";
  return "pending";
}

export function PipelineProgress({
  events,
  currentStage,
  isRunning,
  error,
  result,
}: PipelineProgressProps) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-border flex items-center gap-3">
        {isRunning && (
          <Loader2 size={16} className="text-sf-accent animate-spin" />
        )}
        {currentStage === "complete" && (
          <CheckCircle2 size={16} className="text-green-500" />
        )}
        {currentStage === "failed" && (
          <XCircle size={16} className="text-red-500" />
        )}
        <h3 className="font-semibold text-sf-text-primary text-sm font-display">
          {isRunning
            ? "Analysis in progress..."
            : currentStage === "complete"
              ? "Analysis complete"
              : currentStage === "failed"
                ? "Analysis failed"
                : "Analysis"}
        </h3>
        {result && (
          <span className="ml-auto text-xs text-sf-text-muted">
            {result.sessionsScanned} sessions &rarr; {result.insightsExtracted}{" "}
            insights &middot; {Math.round(result.durationMs / 1000)}s
          </span>
        )}
      </div>

      {/* Stage timeline */}
      <div className="px-4 py-3 space-y-1">
        {STAGE_META.map((stage) => {
          const state = stageState(stage.key, currentStage, isRunning);
          const Icon = stage.icon;
          const stageEvents = events.filter((e) => e.stage === stage.key);

          return (
            <div key={stage.key} className="flex gap-3">
              {/* Timeline line + icon */}
              <div className="flex flex-col items-center w-6 flex-shrink-0">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    state === "active" && "bg-sf-accent/20",
                    state === "done" && "bg-green-500/20",
                    state === "failed" && "bg-red-500/20",
                    state === "pending" && "bg-sf-bg-tertiary"
                  )}
                >
                  {state === "active" ? (
                    <Loader2
                      size={14}
                      className="text-sf-accent animate-spin"
                    />
                  ) : state === "done" ? (
                    <Icon size={14} className="text-green-500" />
                  ) : state === "failed" ? (
                    <XCircle size={14} className="text-red-500" />
                  ) : (
                    <Icon size={14} className="text-sf-text-muted" />
                  )}
                </div>
                <div
                  className={cn(
                    "w-px flex-1 min-h-[8px]",
                    state === "done" ? "bg-green-500/30" : "bg-sf-border"
                  )}
                />
              </div>

              {/* Content */}
              <div className="pb-3 flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    state === "active" && "text-sf-accent",
                    state === "done" && "text-green-500",
                    state === "failed" && "text-red-500",
                    state === "pending" && "text-sf-text-muted"
                  )}
                >
                  {stage.label}
                </p>
                {stageEvents.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {stageEvents.map((evt, i) => (
                      <p
                        key={i}
                        className="text-xs text-sf-text-muted truncate"
                      >
                        {evt.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error detail */}
      {error && (
        <div className="px-4 py-3 border-t border-red-500/20 bg-red-500/5">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
