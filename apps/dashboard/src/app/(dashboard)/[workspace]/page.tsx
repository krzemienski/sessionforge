"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useSessions, useScanSessions } from "@/hooks/use-sessions";
import { useInsights } from "@/hooks/use-insights";
import { useContent } from "@/hooks/use-content";
import { timeAgo } from "@/lib/utils";
import { Zap, ScrollText, Lightbulb, FileText, Clock } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-sf-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-sf-text-muted" />
        <span className="text-xs text-sf-text-secondary font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold font-display text-sf-text-primary">{value}</p>
      {sub && <p className="text-xs text-sf-text-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardHome() {
  const { workspace } = useParams<{ workspace: string }>();
  const sessions = useSessions(workspace, { limit: 100 });
  const insights = useInsights(workspace, { limit: 100 });
  const content = useContent(workspace, { limit: 100 });
  const scan = useScanSessions(workspace);

  const sessionList = sessions.data?.sessions ?? [];
  const insightList = insights.data?.insights ?? [];
  const contentList = content.data?.posts ?? [];
  const drafts = contentList.filter((p: any) => p.status === "draft");
  const lastScan = sessionList[0]?.scannedAt;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <button
          onClick={() => scan.mutate(30)}
          disabled={scan.isPending}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <Zap size={16} />
          {scan.isPending ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ScrollText} label="Sessions" value={sessionList.length} sub="indexed sessions" />
        <StatCard icon={Lightbulb} label="Insights" value={insightList.length} sub={insightList.length > 0 ? `avg score ${(insightList.reduce((s: number, i: any) => s + (i.compositeScore || 0), 0) / insightList.length).toFixed(1)}` : undefined} />
        <StatCard icon={FileText} label="Drafts" value={drafts.length} sub={`${contentList.length} total posts`} />
        <StatCard icon={Clock} label="Last Scan" value={lastScan ? timeAgo(lastScan) : "Never"} sub={lastScan ? new Date(lastScan).toLocaleDateString() : "Run your first scan"} />
      </div>

      {sessionList.length === 0 && !sessions.isLoading && (
        <div className="text-center py-16 bg-sf-bg-secondary border border-sf-border rounded-sf-lg">
          <ScrollText size={48} className="mx-auto text-sf-text-muted mb-4" />
          <h2 className="text-lg font-semibold text-sf-text-primary mb-2">No sessions found</h2>
          <p className="text-sf-text-secondary mb-6">Scan your Claude Code sessions to get started</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => scan.mutate(30)}
              disabled={scan.isPending}
              className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
            >
              <Zap size={16} />
              {scan.isPending ? "Scanning..." : "Scan Sessions"}
            </button>
            <Link
              href="/onboarding"
              className="text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
            >
              View setup guide →
            </Link>
          </div>
        </div>
      )}

      {scan.isSuccess && (
        <div className="bg-sf-accent-bg border border-sf-accent/20 rounded-sf-lg p-4 mb-6">
          <p className="text-sf-accent text-sm">
            Scan complete: {scan.data?.scanned ?? 0} files scanned, {scan.data?.indexed ?? 0} sessions indexed
          </p>
        </div>
      )}
    </div>
  );
}
