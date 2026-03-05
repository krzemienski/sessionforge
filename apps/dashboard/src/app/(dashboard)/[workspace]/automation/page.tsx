"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Zap, Plus, Trash2, Play, Clock, Eye, PauseCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn, timeAgo } from "@/lib/utils";
import { getNextRunTime, formatNextRun } from "@/lib/automation/cron-utils";

const ACTIVE_STATUSES = ["pending", "scanning", "extracting", "generating"];

function getStatusClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-500 text-white";
    case "scanning":
    case "extracting":
    case "generating":
      return "bg-blue-500 text-white animate-pulse";
    case "complete":
      return "bg-green-500 text-white";
    case "failed":
      return "bg-red-500 text-white";
    default:
      return "bg-sf-bg-tertiary text-sf-text-secondary";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Queued";
    case "scanning":
      return "Scanning sessions";
    case "extracting":
      return "Extracting insights";
    case "generating":
      return "Generating content";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function formatDuration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return null;
  const secs = (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  if (secs < 60) return `${Math.round(secs)}s`;
  return `${(secs / 60).toFixed(1)}m`;
}

export default function AutomationPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("Weekly Blog");
  const [triggerType, setTriggerType] = useState("scheduled");
  const [contentType, setContentType] = useState("blog_post");
  const [cron, setCron] = useState("0 9 * * MON");
  const [debounceMinutes, setDebounceMinutes] = useState(30);

  const triggers = useQuery({
    queryKey: ["triggers", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/automation/triggers?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const runs = useQuery({
    queryKey: ["runs", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/automation/runs?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as { runs?: any[] } | undefined;
      const hasActive = (data?.runs ?? []).some((r: any) => ACTIVE_STATUSES.includes(r.status));
      return hasActive ? 3000 : 0;
    },
  });

  const create = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/automation/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, workspaceSlug: workspace }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["triggers"] }); setShowForm(false); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/automation/triggers/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await fetch(`/api/automation/triggers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });

  const execute = useMutation({
    mutationFn: async (triggerId: string) => {
      const res = await fetch("/api/automation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerId }),
      });
      if (res.status === 409) throw new Error("Pipeline already running");
      if (!res.ok) throw new Error("Failed to start pipeline");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });

  const triggerList = triggers.data?.triggers ?? [];
  const runList: any[] = runs.data?.runs ?? [];

  const runsByTrigger = runList.reduce<Record<string, any[]>>((acc, run) => {
    const key = run.triggerId ?? "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(run);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Automation</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors">
          <Plus size={16} /> New Trigger
        </button>
      </div>

      {showForm && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trigger name" className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary" />
          <div className="grid grid-cols-2 gap-3">
            <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary">
              <option value="manual">Manual</option>
              <option value="scheduled">Scheduled</option>
              <option value="file_watch">File Watch</option>
            </select>
            <select value={contentType} onChange={(e) => setContentType(e.target.value)} className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary">
              <option value="blog_post">Blog Post</option>
              <option value="twitter_thread">Twitter Thread</option>
              <option value="changelog">Changelog</option>
              <option value="social_analytics_sync">Social Analytics Sync</option>
            </select>
          </div>
          {triggerType === "scheduled" && contentType === "social_analytics_sync" && (
            <div className="space-y-2">
              <p className="text-xs text-sf-text-secondary">Sync schedule preset</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCron("0 * * * *")}
                  className={cn("px-3 py-1.5 rounded-sf text-xs font-medium border transition-colors", cron === "0 * * * *" ? "bg-sf-accent text-sf-bg-primary border-sf-accent" : "bg-sf-bg-tertiary text-sf-text-secondary border-sf-border hover:border-sf-accent")}
                >
                  Hourly
                </button>
                <button
                  type="button"
                  onClick={() => setCron("0 0 * * *")}
                  className={cn("px-3 py-1.5 rounded-sf text-xs font-medium border transition-colors", cron === "0 0 * * *" ? "bg-sf-accent text-sf-bg-primary border-sf-accent" : "bg-sf-bg-tertiary text-sf-text-secondary border-sf-border hover:border-sf-accent")}
                >
                  Daily
                </button>
              </div>
              <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="Cron expression" className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code" />
            </div>
          )}
          {triggerType === "scheduled" && contentType !== "social_analytics_sync" && (
            <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="Cron expression" className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code" />
          )}
          {triggerType === "file_watch" && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-sf-text-secondary whitespace-nowrap">Debounce window (minutes)</label>
              <input type="number" min={1} value={debounceMinutes} onChange={(e) => setDebounceMinutes(Number(e.target.value))} className="w-24 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary" />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => create.mutate({ name, triggerType, contentType, cronExpression: triggerType === "scheduled" ? cron : undefined, debounceMinutes: triggerType === "file_watch" ? debounceMinutes : undefined })} className="bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium">Save</button>
            <button onClick={() => setShowForm(false)} className="text-sf-text-secondary px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {triggerList.map((t: any) => {
          const triggerRuns: any[] = runsByTrigger[t.id] ?? [];
          return (
            <div key={t.id}>
              {/* Trigger card */}
              <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sf-text-primary">{t.name}</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => execute.mutate(t.id)}
                      disabled={execute.isPending}
                      title={execute.error && execute.variables === t.id ? execute.error.message : undefined}
                      className="flex items-center gap-1.5 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-3 py-1.5 rounded-sf text-xs font-medium hover:border-sf-accent hover:text-sf-accent transition-colors disabled:opacity-50"
                    >
                      <Play size={12} /> Run Now
                    </button>
                    {execute.isError && execute.variables === t.id && (
                      <span className="text-xs text-red-400">{execute.error.message}</span>
                    )}
                    <button
                      onClick={() => toggle.mutate({ id: t.id, enabled: !t.enabled })}
                      className={cn("w-10 h-5 rounded-full transition-colors relative", t.enabled ? "bg-sf-accent" : "bg-sf-bg-tertiary border border-sf-border")}
                    >
                      <div className={cn("w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform", t.enabled ? "translate-x-5" : "translate-x-0.5")} />
                    </button>
                    <button onClick={() => del.mutate(t.id)} className="text-sf-text-muted hover:text-sf-danger"><Trash2 size={16} /></button>
                  </div>
                </div>
                <p className="text-xs text-sf-text-secondary">
                  {t.triggerType === "scheduled" ? `Scheduled` : t.triggerType} · {t.contentType?.replace(/_/g, " ")} · {t.lookbackWindow?.replace(/_/g, " ")}
                </p>
                {t.cronExpression && <p className="text-xs text-sf-text-muted font-code mt-1">{t.cronExpression}</p>}
                {t.triggerType === "scheduled" && t.cronExpression && (() => {
                  const nextRun = getNextRunTime(t.cronExpression);
                  return nextRun ? (
                    <p className="text-xs text-sf-text-secondary mt-1">Next run: {formatNextRun(nextRun)}</p>
                  ) : null;
                })()}
                {t.qstashScheduleId && t.triggerType !== "file_watch" && (
                  <span className="inline-flex items-center gap-1 text-xs text-sf-accent mt-1">
                    <Clock size={11} />
                    Scheduled
                  </span>
                )}
                {t.triggerType === "file_watch" && t.watchStatus && (
                  <span className={cn("inline-flex items-center gap-1 text-xs mt-1", t.watchStatus === "watching" ? "text-sf-accent" : t.watchStatus === "error" ? "text-sf-danger" : "text-sf-text-muted")}>
                    {t.watchStatus === "watching" && <Eye size={11} />}
                    {t.watchStatus === "paused" && <PauseCircle size={11} />}
                    {t.watchStatus === "error" && <AlertCircle size={11} />}
                    {t.watchStatus}
                  </span>
                )}
                {t.triggerType === "file_watch" && t.lastFileEventAt && (
                  <p className="text-xs text-sf-text-muted mt-1">Last file event: {timeAgo(t.lastFileEventAt)}</p>
                )}
                {t.lastRunAt && <p className="text-xs text-sf-text-muted mt-1">Last run: {timeAgo(t.lastRunAt)} ({t.lastRunStatus || "unknown"})</p>}
              </div>

              {/* Recent Runs for this trigger */}
              <div className="mt-2 ml-4">
                <h4 className="text-xs font-medium text-sf-text-muted mb-2">
                  Recent Runs{triggerRuns.length > 0 && <span className="text-sf-text-secondary ml-1">({triggerRuns.length})</span>}
                </h4>
                {triggerRuns.length === 0 ? (
                  <p className="text-xs text-sf-text-muted italic">No runs yet - click Run Now to start</p>
                ) : (
                  <div className="space-y-1.5">
                    {triggerRuns.map((run: any) => {
                      const duration = formatDuration(run.startedAt ?? null, run.completedAt ?? null);
                      return (
                        <div key={run.id} className="flex items-center gap-2 text-xs text-sf-text-secondary flex-wrap">
                          <span className={cn("px-2 py-0.5 rounded-sf-full text-xs font-medium", getStatusClass(run.status))}>
                            {getStatusLabel(run.status)}
                          </span>
                          <span className="text-sf-text-muted">{run.startedAt ? timeAgo(run.startedAt) : "—"}</span>
                          {duration && <span className="text-sf-text-muted">· {duration}</span>}
                          {run.postId && (
                            <Link href={`/${workspace}/content/${run.postId}`} className="text-sf-accent hover:underline ml-1">
                              View post →
                            </Link>
                          )}
                          {run.status === "failed" && run.errorMessage && (
                            <span className="text-red-400 truncate max-w-xs" title={run.errorMessage}>
                              {run.errorMessage.length > 60 ? `${run.errorMessage.slice(0, 60)}…` : run.errorMessage}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {triggerList.length === 0 && !triggers.isLoading && (
          <div className="text-center py-12">
            <Zap size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-secondary">No automation triggers yet. Create one to automate content generation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
