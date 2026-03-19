"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Brain,
  PenTool,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Timer,
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
  activeAgentIndex,
}: {
  stage: (typeof STAGES)[number];
  state: "idle" | "pending" | "active" | "done" | "failed";
  activeAgentIndex?: number;
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
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sf-text-primary text-sm font-display">{stage.label}</h3>
          <p className="text-xs text-sf-text-muted">{stage.description}</p>
        </div>
        {state === "done" && <CheckCircle2 size={16} className="text-green-500 ml-auto flex-shrink-0" />}
        {state === "failed" && <XCircle size={16} className="text-red-500 ml-auto flex-shrink-0" />}
        {state === "active" && (
          <span className="text-[10px] font-mono text-sf-accent bg-sf-accent/10 px-1.5 py-0.5 rounded ml-auto flex-shrink-0">
            ACTIVE
          </span>
        )}
      </div>

      {/* Agents list — with per-agent status indicators */}
      <div className="px-4 py-3 space-y-2 flex-1">
        {stage.agents.map((agent, idx) => {
          // When stage is active, show progress through agents
          const agentState = state === "done" ? "done" :
            state === "active" ? (
              activeAgentIndex !== undefined
                ? (idx < activeAgentIndex ? "done" : idx === activeAgentIndex ? "active" : "pending")
                : "active" // If no specific index, all agents pulse as active
            ) :
            "idle";

          return (
            <div key={agent.name} className={cn(
              "flex items-start gap-2 rounded px-1.5 py-1 -mx-1.5 transition-colors",
              agentState === "active" && "bg-sf-accent/5"
            )}>
              <div className="relative mt-1.5 flex-shrink-0">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  agentState === "done" ? "bg-green-500" :
                  agentState === "active" ? "bg-sf-accent" :
                  "bg-sf-text-muted/40"
                )} />
                {agentState === "active" && (
                  <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-sf-accent animate-ping" />
                )}
              </div>
              <div className="min-w-0">
                <p className={cn(
                  "text-xs font-medium font-code",
                  agentState === "active" ? "text-sf-accent" :
                  agentState === "done" ? "text-green-400" :
                  "text-sf-text-primary"
                )}>{agent.name}</p>
                <p className="text-xs text-sf-text-muted">{agent.role}</p>
              </div>
              {agentState === "done" && (
                <CheckCircle2 size={10} className="text-green-500 mt-1.5 ml-auto flex-shrink-0" />
              )}
              {agentState === "active" && (
                <Loader2 size={10} className="text-sf-accent mt-1.5 ml-auto flex-shrink-0 animate-spin" />
              )}
            </div>
          );
        })}
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

/** Live elapsed timer for active runs */
function useElapsedTime(startedAt: string | null, isActive: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt || !isActive) { setElapsed(0); return; }
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, isActive]);
  return elapsed;
}

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export function PipelineFlow({ lastRun, workspace }: PipelineFlowProps) {
  const runStatus = (lastRun?.status as RunStatus) ?? null;
  const isActive = !!runStatus && ["scanning", "extracting", "generating", "pending"].includes(runStatus);
  const elapsed = useElapsedTime(lastRun?.startedAt ?? null, isActive);
  const isStuck = isActive && elapsed > STUCK_THRESHOLD_MS;

  // Determine the human-readable active stage name
  const activeStageLabel = runStatus === "scanning" ? "Scanning sessions" :
    runStatus === "extracting" ? "Extracting insights" :
    runStatus === "generating" ? "Generating content" :
    runStatus === "pending" ? "Queued" : null;

  return (
    <div className="space-y-6">
      {/* Stuck warning banner */}
      {isStuck && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-sf-lg px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-500">Pipeline may be stuck</p>
            <p className="text-xs text-yellow-500/70 mt-1">
              The <span className="font-medium">{activeStageLabel?.toLowerCase()}</span> stage has been running for{" "}
              <span className="font-mono font-medium">{formatElapsed(elapsed)}</span> with no progress.
              {runStatus === "extracting" && lastRun?.insightsExtracted === 0 &&
                " Zero insights extracted so far — the AI agent may have timed out or encountered an error."
              }
            </p>
            <p className="text-xs text-yellow-500/50 mt-1">
              Previous successful run completed in {lastRun?.durationMs ? formatMs(lastRun.durationMs) : "~10m"}.
              Consider cancelling and re-running from Automation.
            </p>
          </div>
        </div>
      )}

      {/* Last run summary bar — enhanced */}
      {lastRun && (
        <div className={cn(
          "bg-sf-bg-secondary border rounded-sf-lg px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm",
          isStuck ? "border-yellow-500/30" : "border-sf-border"
        )}>
          <div className="flex items-center gap-2">
            {runStatus === "complete" && <CheckCircle2 size={16} className="text-green-500" />}
            {runStatus === "failed" && <XCircle size={16} className="text-red-500" />}
            {isActive && !isStuck && <Loader2 size={16} className="text-sf-accent animate-spin" />}
            {isActive && isStuck && <AlertTriangle size={16} className="text-yellow-500" />}
            <span className="text-sf-text-primary font-medium">
              {runStatus === "complete" ? "Last pipeline succeeded" :
               runStatus === "failed" ? "Last pipeline failed" :
               activeStageLabel ? `${activeStageLabel}...` : "Unknown"}
            </span>
          </div>

          {/* Live elapsed timer */}
          {isActive && (
            <span className="text-sf-text-muted text-xs flex items-center gap-1 font-mono">
              <Timer size={12} className={isStuck ? "text-yellow-500" : "text-sf-accent"} />
              <span className={isStuck ? "text-yellow-500" : "text-sf-accent"}>
                {formatElapsed(elapsed)}
              </span>
            </span>
          )}

          {lastRun.triggerName && (
            <span className="text-sf-text-muted text-xs">
              Trigger: <span className="text-sf-text-secondary">{lastRun.triggerName}</span>
            </span>
          )}
          {lastRun.sessionsScanned != null && (
            <span className="text-sf-text-muted text-xs">
              Sessions: <span className="text-sf-text-secondary font-medium">{lastRun.sessionsScanned.toLocaleString()}</span>
            </span>
          )}
          {lastRun.insightsExtracted != null && (
            <span className="text-sf-text-muted text-xs">
              Insights: <span className={cn(
                "font-medium",
                isActive && lastRun.insightsExtracted === 0 ? "text-yellow-500" : "text-sf-text-secondary"
              )}>{lastRun.insightsExtracted}</span>
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
          {isActive && lastRun.startedAt && (
            <span className="text-sf-text-muted text-xs ml-auto">
              Started {timeAgo(lastRun.startedAt)}
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

          // Estimate which agent is active based on elapsed time within the stage
          // Each agent gets ~proportional time; shift through them as time passes
          let activeAgentIndex: number | undefined;
          if (state === "active" && elapsed > 0) {
            const agentCount = stage.agents.length;
            // Assume each agent gets ~2 min; cycle through based on elapsed
            const perAgentMs = 120_000;
            const idx = Math.min(Math.floor(elapsed / perAgentMs), agentCount - 1);
            activeAgentIndex = idx;
          }

          return (
            <div key={stage.id} className="flex flex-col lg:flex-row items-stretch flex-1">
              <StageCard stage={stage} state={state} activeAgentIndex={activeAgentIndex} />
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
