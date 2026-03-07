"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { PipelineFlow } from "@/components/pipeline/pipeline-flow";
import { formatMs, timeAgo } from "@/lib/utils";
import { type PipelineRun, statusBadgeClass, statusLabel, ACTIVE_STATUSES } from "@/lib/pipeline-status";

export default function ObservabilityPage() {
  const { workspace } = useParams<{ workspace: string }>();

  const runs = useQuery({
    queryKey: ["pipeline-runs", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/automation/runs?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load pipeline runs");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as { runs?: PipelineRun[] } | undefined;
      const hasActive = (data?.runs ?? []).some((r) => ACTIVE_STATUSES.includes(r.status));
      return hasActive ? 3000 : 0;
    },
  });

  const runList: PipelineRun[] = runs.data?.runs ?? [];
  const lastRun = runList.length > 0 ? runList[0] : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Activity size={24} className="text-sf-accent" />
        <div>
          <h1 className="text-2xl font-bold font-display">Pipeline</h1>
          <p className="text-sm text-sf-text-muted">
            Session ingestion, insight extraction, and content generation flow
          </p>
        </div>
      </div>

      <PipelineFlow lastRun={lastRun} workspace={workspace} />

      {/* Recent runs table */}
      {runList.length > 1 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-sf-text-primary uppercase tracking-wide mb-3 font-display">
            Run History
          </h2>
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sf-border text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide">Trigger</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide hidden sm:table-cell">Sessions</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide hidden sm:table-cell">Insights</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide hidden md:table-cell">Duration</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-sf-text-muted uppercase tracking-wide">When</th>
                </tr>
              </thead>
              <tbody>
                {runList.slice(0, 20).map((run) => (
                  <tr key={run.id} className="border-b border-sf-border/50 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className={statusBadgeClass(run.status)}>
                        {statusLabel(run.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sf-text-secondary">{run.triggerName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-sf-text-secondary hidden sm:table-cell">{run.sessionsScanned ?? "—"}</td>
                    <td className="px-4 py-2.5 text-sf-text-secondary hidden sm:table-cell">{run.insightsExtracted ?? "—"}</td>
                    <td className="px-4 py-2.5 text-sf-text-muted hidden md:table-cell">
                      {run.durationMs ? formatMs(run.durationMs) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sf-text-muted">
                      {run.startedAt ? timeAgo(run.startedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
