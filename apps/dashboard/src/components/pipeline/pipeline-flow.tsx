"use client";

import {
  Search,
  Brain,
  PenTool,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { cn, formatMs, timeAgo } from "@/lib/utils";
import { type RunStatus, type PipelineRun } from "@/lib/pipeline-status";

interface PipelineFlowProps {
  lastRun: PipelineRun | null;
  workspace: string;
}

const STAGES = [
  {
    id: "scan",
    label: "Scan",
    icon: Search,
    statusKey: "scanning" as RunStatus,
    description: "Discover and parse session files",
    agents: [
      { name: "scanSessionFiles", role: "Find local session files in lookback window" },
      { name: "ssh-scanner", role: "Scan remote hosts via SSH/SFTP" },
      { name: "parseSessionFile", role: "Parse JSONL transcripts" },
      { name: "normalizeSession", role: "Normalize metadata + content" },
      { name: "indexSessions", role: "Store in database with deduplication" },
    ],
  },
  {
    id: "extract",
    label: "Extract",
    icon: Brain,
    statusKey: "extracting" as RunStatus,
    description: "Analyze corpus and extract insights",
    agents: [
      { name: "corpus-analyzer", role: "Cross-session pattern detection" },
      { name: "insight-extractor", role: "Extract actionable insights" },
      { name: "style-learner", role: "Learn writing style (non-fatal)" },
      { name: "recommendations-analyzer", role: "Generate topic suggestions" },
    ],
  },
  {
    id: "generate",
    label: "Generate",
    icon: PenTool,
    statusKey: "generating" as RunStatus,
    description: "Route to writer agent by content type",
    agents: [
      { name: "blog-writer", role: "Long-form blog posts" },
      { name: "social-writer", role: "Twitter threads & LinkedIn posts" },
      { name: "changelog-writer", role: "Technical changelogs" },
      { name: "newsletter-writer", role: "Email newsletters" },
      { name: "repurpose-writer", role: "Cross-format repurposing" },
    ],
  },
] as const;

function getStageState(stageStatusKey: RunStatus, runStatus: RunStatus) {
  if (!runStatus) return "idle";
  if (runStatus === "failed") return "failed";
  if (runStatus === "complete") return "done";

  const order: RunStatus[] = ["scanning", "extracting", "generating"];
  const currentIdx = order.indexOf(runStatus);
  const stageIdx = order.indexOf(stageStatusKey);

  if (stageIdx < currentIdx) return "done";
  if (stageIdx === currentIdx) return "active";
  return "pending";
}

function StageCard({
  stage,
  state,
}: {
  stage: (typeof STAGES)[number];
  state: "idle" | "pending" | "active" | "done" | "failed";
}) {
  const Icon = stage.icon;

  const borderColor = {
    idle: "border-sf-border",
    pending: "border-sf-border",
    active: "border-sf-accent",
    done: "border-green-500/40",
    failed: "border-red-500/40",
  }[state];

  const headerBg = {
    idle: "bg-sf-bg-tertiary",
    pending: "bg-sf-bg-tertiary",
    active: "bg-sf-accent/10",
    done: "bg-green-500/10",
    failed: "bg-red-500/10",
  }[state];

  return (
    <div className={cn("bg-sf-bg-secondary border rounded-sf-lg overflow-hidden flex flex-col min-w-[240px] flex-1", borderColor)}>
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-center gap-3", headerBg)}>
        <div className="relative">
          <Icon size={20} className={cn(
            state === "active" ? "text-sf-accent" :
            state === "done" ? "text-green-500" :
            state === "failed" ? "text-red-500" :
            "text-sf-text-muted"
          )} />
          {state === "active" && (
            <Loader2 size={12} className="absolute -top-1 -right-1 text-sf-accent animate-spin" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-sf-text-primary text-sm font-display">{stage.label}</h3>
          <p className="text-xs text-sf-text-muted">{stage.description}</p>
        </div>
        {state === "done" && <CheckCircle2 size={16} className="text-green-500 ml-auto flex-shrink-0" />}
        {state === "failed" && <XCircle size={16} className="text-red-500 ml-auto flex-shrink-0" />}
      </div>

      {/* Agents list */}
      <div className="px-4 py-3 space-y-2 flex-1">
        {stage.agents.map((agent) => (
          <div key={agent.name} className="flex items-start gap-2">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
              state === "done" ? "bg-green-500" :
              state === "active" ? "bg-sf-accent" :
              "bg-sf-text-muted/40"
            )} />
            <div>
              <p className="text-xs font-medium text-sf-text-primary font-code">{agent.name}</p>
              <p className="text-xs text-sf-text-muted">{agent.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageConnector({ state }: { state: "idle" | "pending" | "active" | "done" | "failed" }) {
  return (
    <div className="flex items-center justify-center py-2 lg:py-0 lg:px-1">
      <ArrowRight
        size={20}
        className={cn(
          "rotate-90 lg:rotate-0",
          state === "done" ? "text-green-500" :
          state === "active" ? "text-sf-accent animate-pulse" :
          "text-sf-text-muted/40"
        )}
      />
    </div>
  );
}

export function PipelineFlow({ lastRun, workspace }: PipelineFlowProps) {
  const runStatus = (lastRun?.status as RunStatus) ?? null;

  return (
    <div className="space-y-6">
      {/* Last run summary bar */}
      {lastRun && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            {runStatus === "complete" && <CheckCircle2 size={16} className="text-green-500" />}
            {runStatus === "failed" && <XCircle size={16} className="text-red-500" />}
            {runStatus && ["scanning", "extracting", "generating", "pending"].includes(runStatus) && (
              <Loader2 size={16} className="text-sf-accent animate-spin" />
            )}
            <span className="text-sf-text-primary font-medium">
              {runStatus === "complete" ? "Last pipeline succeeded" :
               runStatus === "failed" ? "Last pipeline failed" :
               runStatus ? "Pipeline running..." : "Unknown"}
            </span>
          </div>
          {lastRun.triggerName && (
            <span className="text-sf-text-muted text-xs">
              Trigger: <span className="text-sf-text-secondary">{lastRun.triggerName}</span>
            </span>
          )}
          {lastRun.sessionsScanned != null && (
            <span className="text-sf-text-muted text-xs">
              Sessions: <span className="text-sf-text-secondary">{lastRun.sessionsScanned}</span>
            </span>
          )}
          {lastRun.insightsExtracted != null && (
            <span className="text-sf-text-muted text-xs">
              Insights: <span className="text-sf-text-secondary">{lastRun.insightsExtracted}</span>
            </span>
          )}
          {lastRun.durationMs != null && (
            <span className="text-sf-text-muted text-xs flex items-center gap-1">
              <Clock size={11} />
              {formatMs(lastRun.durationMs)}
            </span>
          )}
          {lastRun.completedAt && (
            <span className="text-sf-text-muted text-xs ml-auto">
              {timeAgo(lastRun.completedAt)}
            </span>
          )}
        </div>
      )}

      {/* Pipeline flow diagram */}
      <div className="flex flex-col lg:flex-row items-stretch gap-0">
        {STAGES.map((stage, i) => {
          const state = getStageState(stage.statusKey, runStatus);
          const connectorState = i < STAGES.length - 1
            ? getStageState(STAGES[i + 1].statusKey, runStatus)
            : "idle";

          return (
            <div key={stage.id} className="flex flex-col lg:flex-row items-stretch flex-1">
              <StageCard stage={stage} state={state} />
              {i < STAGES.length - 1 && <StageConnector state={connectorState} />}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {!lastRun && (
        <div className="text-center py-8">
          <p className="text-sf-text-muted text-sm">
            No pipeline runs yet. Set up a trigger in{" "}
            <a href={`/${workspace}/automation`} className="text-sf-accent hover:underline">
              Automation
            </a>{" "}
            to start generating content.
          </p>
        </div>
      )}
    </div>
  );
}
