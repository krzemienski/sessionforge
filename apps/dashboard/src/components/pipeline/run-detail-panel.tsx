"use client";

import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ExternalLink,
  Zap,
  FileText,
  Calendar,
  Tag,
  Layers,
} from "lucide-react";
import { cn, formatMs, timeAgo, formatDate } from "@/lib/utils";
import { statusBadgeClass, statusLabel } from "@/lib/pipeline-status";
import type { RunDetail } from "@/hooks/use-run-detail";

interface RunDetailPanelProps {
  runDetail: RunDetail;
  onClose?: () => void;
}

/* ── helpers ──────────────────────────────────────────────── */

const eventTypeConfig: Record<
  string,
  { icon: typeof CheckCircle2; color: string; bg: string }
> = {
  start: { icon: Play, color: "text-blue-500", bg: "bg-blue-500/10" },
  stage: { icon: Layers, color: "text-sf-accent", bg: "bg-sf-accent/10" },
  complete: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

const defaultEventConfig = {
  icon: Zap,
  color: "text-sf-text-muted",
  bg: "bg-sf-bg-tertiary",
};

function inferErrorClass(message: string | null): string | null {
  if (!message) return null;
  if (/timeout|timed?\s*out/i.test(message)) return "Timeout";
  if (/rate.?limit|429/i.test(message)) return "Rate Limit";
  if (/auth|unauthorized|403|401/i.test(message)) return "Auth Error";
  if (/not found|404/i.test(message)) return "Not Found";
  if (/ECONNREFUSED|ENOTFOUND|network/i.test(message))
    return "Network Error";
  if (/parse|syntax|json/i.test(message)) return "Parse Error";
  return "Runtime Error";
}

/* ── section components ──────────────────────────────────── */

function SectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof Clock;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-sf-text-muted" />
      <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wide">
        {title}
      </h4>
    </div>
  );
}

function RunSummary({ run }: { run: RunDetail["run"] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={statusBadgeClass(run.status)}>
        {statusLabel(run.status)}
      </span>
      {run.triggerName && (
        <span className="text-sm text-sf-text-primary font-medium">
          {run.triggerName}
        </span>
      )}
      <div className="flex items-center gap-1.5 text-xs text-sf-text-muted">
        <Clock size={12} />
        <span>Started {timeAgo(run.startedAt)}</span>
      </div>
      {run.completedAt && (
        <div className="flex items-center gap-1.5 text-xs text-sf-text-muted">
          <CheckCircle2 size={12} />
          <span>Ended {timeAgo(run.completedAt)}</span>
        </div>
      )}
      {run.durationMs != null && (
        <span className="text-xs font-mono text-sf-text-secondary bg-sf-bg-tertiary px-1.5 py-0.5 rounded">
          {formatMs(run.durationMs)}
        </span>
      )}
    </div>
  );
}

function ErrorDetails({ errorMessage }: { errorMessage: string }) {
  const errorClass = inferErrorClass(errorMessage);

  return (
    <div className="border border-red-500/20 bg-red-500/5 rounded-sf p-3">
      <SectionHeader title="Error Details" icon={AlertTriangle} />
      {errorClass && (
        <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded mb-2">
          {errorClass}
        </span>
      )}
      <pre className="text-xs font-code text-red-400 whitespace-pre-wrap break-words leading-relaxed">
        {errorMessage}
      </pre>
    </div>
  );
}

function SourceIntegration({ run }: { run: RunDetail["run"] }) {
  return (
    <div>
      <SectionHeader title="Source Integration" icon={FileText} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-sf-text-muted uppercase tracking-wider mb-0.5">
            Content Type
          </p>
          <p className="text-sm text-sf-text-primary font-medium">
            {run.source || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-sf-text-muted uppercase tracking-wider mb-0.5">
            Trigger Type
          </p>
          <p className="text-sm text-sf-text-primary font-medium">
            {run.triggerType || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-sf-text-muted uppercase tracking-wider mb-0.5">
            Sessions Scanned
          </p>
          <p className="text-sm text-sf-text-primary font-medium">
            {run.sessionsScanned}
          </p>
        </div>
      </div>
    </div>
  );
}

function RetryHistory({
  agentRuns,
  events,
}: {
  agentRuns: RunDetail["agentRuns"];
  events: RunDetail["events"];
}) {
  const retryRuns = agentRuns.filter(
    (r) => r.attemptCount != null && Number(r.attemptCount) > 1,
  );
  const retryEvents = events.filter(
    (e) => e.eventType === "system:retry" || e.eventType === "retry",
  );

  if (retryRuns.length === 0 && retryEvents.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Retry History" icon={RotateCcw} />
      <div className="space-y-2">
        {retryRuns.map((run) => (
          <div
            key={run.id}
            className="flex items-center gap-2 text-xs bg-sf-bg-tertiary rounded-sf px-3 py-2"
          >
            <RotateCcw size={12} className="text-yellow-500 flex-shrink-0" />
            <span className="text-sf-text-primary font-medium font-code">
              {run.agentType}
            </span>
            <span className="text-sf-text-muted">
              attempt #{String(run.attemptCount ?? "?")}
            </span>
            <span className="text-sf-text-muted ml-auto">
              {run.status === "complete" ? (
                <CheckCircle2
                  size={12}
                  className="text-emerald-500 inline-block"
                />
              ) : run.status === "failed" ? (
                <XCircle size={12} className="text-red-500 inline-block" />
              ) : (
                <Loader2
                  size={12}
                  className="text-sf-accent animate-spin inline-block"
                />
              )}
            </span>
          </div>
        ))}
        {retryEvents.map((evt) => (
          <div
            key={evt.id}
            className="flex items-center gap-2 text-xs bg-sf-bg-tertiary rounded-sf px-3 py-2"
          >
            <RotateCcw size={12} className="text-yellow-500 flex-shrink-0" />
            <span className="text-sf-text-primary">{evt.message}</span>
            <span className="text-sf-text-muted ml-auto">
              {timeAgo(evt.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventTimeline({ events }: { events: RunDetail["events"] }) {
  if (events.length === 0) {
    return (
      <div>
        <SectionHeader title="Event Timeline" icon={Calendar} />
        <p className="text-xs text-sf-text-muted text-center py-4">
          No events recorded
        </p>
      </div>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div>
      <SectionHeader title="Event Timeline" icon={Calendar} />
      <div className="relative space-y-0">
        {/* vertical connector line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-sf-border" />

        {sorted.map((evt) => {
          const config = eventTypeConfig[evt.eventType] ?? defaultEventConfig;
          const Icon = config.icon;

          return (
            <div key={evt.id} className="flex items-start gap-3 relative py-1.5">
              <div
                className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center z-10",
                  config.bg,
                )}
              >
                <Icon size={12} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-sf-text-primary truncate">
                    {evt.message}
                  </span>
                  <span className="text-[10px] font-code text-sf-text-muted bg-sf-bg-tertiary px-1 py-0.5 rounded flex-shrink-0">
                    {evt.agentType}
                  </span>
                </div>
                <p className="text-[10px] text-sf-text-muted mt-0.5">
                  {formatDate(evt.createdAt)} · {evt.eventType}
                  {evt.level !== "info" && (
                    <span
                      className={cn(
                        "ml-1.5 uppercase font-semibold",
                        evt.level === "error"
                          ? "text-red-400"
                          : evt.level === "warn"
                            ? "text-yellow-400"
                            : "",
                      )}
                    >
                      {evt.level}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextAction({ run }: { run: RunDetail["run"] }) {
  if (run.status === "failed") {
    return (
      <div className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-sf px-3 py-2">
        <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0" />
        <span className="text-xs text-sf-text-secondary">
          Re-run this pipeline from the Automation page to retry
        </span>
        <ExternalLink size={12} className="text-sf-text-muted ml-auto flex-shrink-0" />
      </div>
    );
  }

  if (run.status === "complete" && run.postId) {
    return (
      <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-sf px-3 py-2">
        <FileText size={14} className="text-emerald-500 flex-shrink-0" />
        <span className="text-xs text-sf-text-secondary">
          View the generated post in Content
        </span>
        <ExternalLink size={12} className="text-sf-text-muted ml-auto flex-shrink-0" />
      </div>
    );
  }

  if (run.status === "complete") {
    return (
      <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-sf px-3 py-2">
        <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
        <span className="text-xs text-sf-text-secondary">
          Run completed successfully — {run.insightsExtracted} insights
          extracted
        </span>
      </div>
    );
  }

  return null;
}

/* ── main component ──────────────────────────────────────── */

export function RunDetailPanel({ runDetail, onClose }: RunDetailPanelProps) {
  const { run, events, agentRuns } = runDetail;

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sf-border bg-sf-bg-tertiary/50">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-sf-text-muted" />
          <span className="text-xs font-mono text-sf-text-muted">
            {run.id.slice(0, 8)}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-sf-text-muted hover:text-sf-text-primary transition-colors p-1 rounded hover:bg-sf-bg-tertiary"
          >
            <ChevronUp size={16} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-5">
        {/* 1. Run Summary */}
        <RunSummary run={run} />

        {/* 2. Error Details (failed only) */}
        {run.status === "failed" && run.errorMessage && (
          <ErrorDetails errorMessage={run.errorMessage} />
        )}

        {/* 3. Source Integration */}
        <SourceIntegration run={run} />

        {/* 4. Retry History */}
        <RetryHistory agentRuns={agentRuns} events={events} />

        {/* 5. Event Timeline */}
        <EventTimeline events={events} />

        {/* 6. Next Action */}
        <NextAction run={run} />
      </div>
    </div>
  );
}
