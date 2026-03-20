"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TrendingUp, Eye, MousePointerClick, Activity, FileText, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { ChannelRoiCard, type ChannelRoiData } from "@/components/analytics/channel-roi-card";
import { AttributionTable, type AttributionPost } from "@/components/analytics/attribution-table";
import { PeriodDeltaBadge } from "@/components/analytics/period-delta-badge";

type Timeframe = "7d" | "30d" | "90d";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

interface RoiTotals {
  current: {
    impressions: number;
    clicks: number;
    engagementRate: number;
    publishCount: number;
  };
  prior: {
    impressions: number;
    clicks: number;
    engagementRate: number;
    publishCount: number;
  };
  deltas: {
    impressions: number | null;
    clicks: number | null;
    engagementRate: number | null;
    publishCount: number | null;
  };
}

interface RoiData {
  timeframe: string;
  currentPeriod: { from: string; to: string };
  priorPeriod: { from: string; to: string };
  totals: RoiTotals;
  byChannel: ChannelRoiData[];
}

interface AttributionData {
  timeframe: string;
  since: string;
  totals: {
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    postsWithSessions: number;
  };
  posts: AttributionPost[];
}

interface TotalMetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  deltaFraction: number | null;
}

function TotalMetricTile({ icon, label, value, deltaFraction }: TotalMetricTileProps) {
  const deltaPercent = deltaFraction !== null ? Math.round(deltaFraction * 100) : null;

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
      <div className="flex items-center gap-2 mb-2 text-sf-text-secondary">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold font-display text-sf-text-primary">{value}</p>
        <div className="mb-0.5">
          <PeriodDeltaBadge current={1} delta={deltaPercent} />
        </div>
      </div>
    </div>
  );
}

export default function RoiPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  const roiQuery = useQuery<RoiData>({
    queryKey: ["roi-analytics", workspace, timeframe],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace, timeframe });
      const res = await fetch(`/api/analytics/roi?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch ROI data");
      return res.json();
    },
    enabled: !!workspace,
  });

  const attributionQuery = useQuery<AttributionData>({
    queryKey: ["attribution-analytics", workspace, timeframe],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace, timeframe });
      const res = await fetch(`/api/analytics/attribution?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch attribution data");
      return res.json();
    },
    enabled: !!workspace,
  });

  const roiData = roiQuery.data;
  const attributionData = attributionQuery.data;
  const isLoading = roiQuery.isLoading || attributionQuery.isLoading;
  const isError = roiQuery.isError || attributionQuery.isError;

  function handleExport() {
    const sp = new URLSearchParams({ workspace });
    const url = `/api/analytics/export?${sp}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `roi-${workspace}-${timeframe}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold font-display mb-4">Analytics</h1>
      <AnalyticsTabs />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold font-display text-sf-text-secondary">
          Attribution &amp; ROI
        </h2>
        <div className="flex items-center gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                "px-3 py-1.5 rounded-sf text-sm font-medium transition-colors",
                timeframe === tf.value
                  ? "bg-sf-accent text-white"
                  : "bg-sf-bg-secondary border border-sf-border text-sf-text-secondary hover:border-sf-border-focus"
              )}
            >
              {tf.label}
            </button>
          ))}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sf text-sm font-medium bg-sf-bg-secondary border border-sf-border text-sf-text-secondary hover:border-sf-border-focus transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-sf-text-secondary">
          <RefreshCw size={20} className="animate-spin mr-2" />
          Loading ROI data…
        </div>
      )}

      {isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-sf-lg p-4 text-red-400 text-sm">
          Failed to load ROI data. Make sure your social integrations are connected.
        </div>
      )}

      {roiData && (
        <>
          {/* Overall Totals */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
              Overall ({timeframe})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <TotalMetricTile
                icon={<Eye size={16} />}
                label="Impressions"
                value={roiData.totals.current.impressions.toLocaleString()}
                deltaFraction={roiData.totals.deltas.impressions}
              />
              <TotalMetricTile
                icon={<MousePointerClick size={16} />}
                label="Clicks"
                value={roiData.totals.current.clicks.toLocaleString()}
                deltaFraction={roiData.totals.deltas.clicks}
              />
              <TotalMetricTile
                icon={<Activity size={16} />}
                label="Engagement Rate"
                value={`${(roiData.totals.current.engagementRate * 100).toFixed(2)}%`}
                deltaFraction={roiData.totals.deltas.engagementRate}
              />
              <TotalMetricTile
                icon={<FileText size={16} />}
                label="Published"
                value={roiData.totals.current.publishCount.toLocaleString()}
                deltaFraction={roiData.totals.deltas.publishCount}
              />
            </div>
          </div>

          {/* Channel ROI Cards */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
              By Channel
            </h2>
            {roiData.byChannel.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roiData.byChannel.map((channel) => (
                  <ChannelRoiCard key={channel.platform} data={channel} />
                ))}
              </div>
            ) : (
              <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-12 flex flex-col items-center justify-center text-center">
                <TrendingUp size={40} className="text-sf-text-secondary opacity-40 mb-3" />
                <p className="text-sf-text-primary font-semibold font-display mb-1">No channel data yet</p>
                <p className="text-sm text-sf-text-secondary max-w-xs">
                  Connect social integrations and sync metrics to see channel ROI breakdowns here.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Attribution Table */}
      {attributionData && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
            Post Attribution
          </h2>
          <AttributionTable
            posts={attributionData.posts}
            workspace={workspace}
          />
        </div>
      )}
    </div>
  );
}
