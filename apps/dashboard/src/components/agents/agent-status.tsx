"use client";

import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import type { AgentRunStatus, RetryInfo } from "@/hooks/use-agent-run";

interface AgentStatusProps {
  status: AgentRunStatus;
  retryInfo: RetryInfo | null;
  error: string | null;
  onRetry: () => void;
  agentLabel: string;
}

/**
 * Displays current agent execution state: progress spinner, retry info,
 * success confirmation, or error with a retry button.
 */
export function AgentStatus({
  status,
  retryInfo,
  error,
  onRetry,
  agentLabel,
}: AgentStatusProps) {
  if (status === "idle") return null;

  if (status === "running") {
    return (
      <div className="flex items-center gap-2 text-sm text-sf-text-secondary mt-2">
        <Loader2 size={14} className="animate-spin text-sf-accent" />
        <span>Generating {agentLabel}...</span>
      </div>
    );
  }

  if (status === "retrying" && retryInfo) {
    return (
      <div className="flex items-center gap-2 text-sm text-sf-text-secondary mt-2">
        <Loader2 size={14} className="animate-spin text-sf-accent" />
        <span>{retryInfo.message}</span>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-500 mt-2">
        <CheckCircle size={14} />
        <span>Done</span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-2 text-sm text-red-500">
          <XCircle size={14} />
          <span>{error ?? "Generation failed"}</span>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-sm bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-3 py-1.5 rounded-sf hover:bg-sf-bg-hover transition-colors"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  return null;
}
