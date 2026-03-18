"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSessions, useScanSessions } from "@/hooks/use-sessions";
import { useInsights } from "@/hooks/use-insights";
import { useContent } from "@/hooks/use-content";
import { useActivity } from "@/hooks/use-activity";
import { ActivityLog } from "@/components/dashboard/activity-log";
import {
  Zap,
  ScrollText,
  Lightbulb,
  FileText,
  ArrowRight,
  CalendarDays,
  PenTool,
  X,
  Sparkles,
} from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: typeof ScrollText;
  label: string;
  value: string | number;
  sub?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-sf-lg hover:border-sf-accent/40 transition-colors group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-sf-text-muted" />
          <span className="text-xs text-sf-text-secondary font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <ArrowRight
          size={14}
          className="text-sf-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
      <p className="text-3xl font-bold font-display text-sf-text-primary">
        {value}
      </p>
      {sub && <p className="text-xs text-sf-text-muted mt-1">{sub}</p>}
    </Link>
  );
}

export default function DashboardHome() {
  const { workspace } = useParams<{ workspace: string }>();
  const sessions = useSessions(workspace, { limit: 100 });
  const insights = useInsights(workspace, { limit: 100 });
  const content = useContent(workspace, { limit: 100 });
  const scan = useScanSessions(workspace);
  const activity = useActivity(workspace);

  const sessionList = sessions.data?.sessions ?? [];
  const insightList = insights.data?.insights ?? [];
  const contentList = content.data?.posts ?? [];
  const drafts = contentList.filter((p: Record<string, unknown>) => p.status === "draft");

  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`sf-welcome-banner-dismissed-${workspace}`);
    const totalSessions = sessions.data?.total ?? sessionList.length;
    if (!dismissed && totalSessions === 0 && !sessions.isLoading) {
      setShowWelcomeBanner(true);
    }
  }, [workspace, sessions.data?.total, sessionList.length, sessions.isLoading]);

  const handleDismissBanner = () => {
    localStorage.setItem(`sf-welcome-banner-dismissed-${workspace}`, "true");
    setShowWelcomeBanner(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <button
          onClick={() => scan.mutate(30)}
          disabled={scan.isPending}
          className="flex items-center justify-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2.5 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50 w-full sm:w-auto min-h-[44px]"
        >
          <Zap size={16} />
          {scan.isPending ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {/* Scan result banner */}
      {scan.isSuccess && (
        <div className="bg-sf-accent-bg border border-sf-accent/20 rounded-sf-lg p-4 mb-6">
          <p className="text-sf-accent text-sm">
            Scan complete: {scan.data?.scanned ?? 0} files scanned,{" "}
            {(scan.data?.new ?? 0) + (scan.data?.updated ?? 0)} sessions indexed
          </p>
        </div>
      )}

      {/* Welcome banner for new users */}
      {showWelcomeBanner && (
        <div className="bg-sf-accent-bg border border-sf-accent/20 rounded-sf-lg p-4 mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <Sparkles size={20} className="text-sf-accent mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sf-text-primary font-semibold mb-1">
                  Welcome to SessionForge!
                </h3>
                <p className="text-sf-text-secondary text-sm mb-3">
                  Get started by completing the setup wizard. We'll help you configure your workspace and start indexing sessions.
                </p>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
                >
                  <Sparkles size={14} />
                  Complete Setup
                </Link>
              </div>
            </div>
            <button
              onClick={handleDismissBanner}
              className="text-sf-text-muted hover:text-sf-text-primary transition-colors flex-shrink-0"
              aria-label="Dismiss welcome banner"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Stats row — clickable cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={ScrollText}
          label="Sessions"
          value={sessions.data?.total ?? sessionList.length}
          sub="indexed sessions"
          href={`/${workspace}/sessions`}
        />
        <StatCard
          icon={Lightbulb}
          label="Insights"
          value={insightList.length}
          sub={
            insightList.length > 0
              ? `avg score ${(insightList.reduce((s: number, i: Record<string, unknown>) => s + ((i.compositeScore as number) || 0), 0) / insightList.length).toFixed(1)}`
              : undefined
          }
          href={`/${workspace}/insights`}
        />
        <StatCard
          icon={FileText}
          label="Content"
          value={contentList.length}
          sub={drafts.length > 0 ? `${drafts.length} drafts` : undefined}
          href={`/${workspace}/content`}
        />
      </div>

      {/* Activity Log */}
      <div className="mb-6">
        <ActivityLog
          events={activity.data?.events ?? []}
          workspace={workspace}
          isLoading={activity.isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
        <h2 className="text-sm font-semibold text-sf-text-primary uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${workspace}/sessions`}
            className="flex items-center gap-2 px-3 py-2 rounded-sf bg-sf-bg-tertiary text-sf-text-secondary text-sm hover:text-sf-accent hover:bg-sf-accent/10 transition-colors"
          >
            <Zap size={14} />
            Scan Sessions
          </Link>
          <Link
            href={`/${workspace}/content/new`}
            className="flex items-center gap-2 px-3 py-2 rounded-sf bg-sf-bg-tertiary text-sf-text-secondary text-sm hover:text-sf-accent hover:bg-sf-accent/10 transition-colors"
          >
            <PenTool size={14} />
            Generate Content
          </Link>
          <Link
            href={`/${workspace}/content?view=calendar`}
            className="flex items-center gap-2 px-3 py-2 rounded-sf bg-sf-bg-tertiary text-sf-text-secondary text-sm hover:text-sf-accent hover:bg-sf-accent/10 transition-colors"
          >
            <CalendarDays size={14} />
            Content Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}
