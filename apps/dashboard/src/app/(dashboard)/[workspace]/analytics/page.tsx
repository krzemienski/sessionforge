"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart2, Eye, Heart, Share2, MessageCircle, MousePointerClick, RefreshCw, Twitter, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendChart } from "@/components/analytics/trend-chart";

type Timeframe = "7d" | "30d" | "90d";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter size={16} className="text-sky-400" />,
  linkedin: <Linkedin size={16} className="text-blue-500" />,
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
};

interface MetricTotals {
  impressions: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
}

interface AnalyticsData {
  timeframe: string;
  since: string;
  totals: MetricTotals;
  byPlatform: Record<string, MetricTotals>;
  posts: Array<{
    id: string;
    platform: string;
    impressions: number | null;
    likes: number | null;
    shares: number | null;
    comments: number | null;
    clicks: number | null;
    syncedAt: string;
  }>;
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 flex items-center gap-3">
      <div className="p-2 rounded-sf bg-sf-bg-tertiary text-sf-text-secondary">{icon}</div>
      <div>
        <p className="text-xs text-sf-text-secondary">{label}</p>
        <p className="text-xl font-bold font-display text-sf-text-primary">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function PlatformRow({
  platform,
  metrics,
}: {
  platform: string;
  metrics: MetricTotals;
}) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {PLATFORM_ICONS[platform]}
        <span className="font-semibold text-sf-text-primary font-display">
          {PLATFORM_LABELS[platform] ?? platform}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Impressions", value: metrics.impressions, icon: <Eye size={14} /> },
          { label: "Likes", value: metrics.likes, icon: <Heart size={14} /> },
          { label: "Shares", value: metrics.shares, icon: <Share2 size={14} /> },
          { label: "Comments", value: metrics.comments, icon: <MessageCircle size={14} /> },
          { label: "Clicks", value: metrics.clicks, icon: <MousePointerClick size={14} /> },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <div className="flex items-center justify-center gap-1 text-sf-text-secondary mb-1">
              {m.icon}
              <span className="text-xs">{m.label}</span>
            </div>
            <p className="text-sm font-bold font-display text-sf-text-primary">
              {m.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  const query = useQuery<AnalyticsData>({
    queryKey: ["social-analytics", workspace, timeframe],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace, timeframe });
      const res = await fetch(`/api/analytics/social?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!workspace,
  });

  const data = query.data;
  const platforms = Object.keys(data?.byPlatform ?? {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Social Analytics</h1>
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
        </div>
      </div>

      {query.isLoading && (
        <div className="flex items-center justify-center py-12 text-sf-text-secondary">
          <RefreshCw size={20} className="animate-spin mr-2" />
          Loading analytics…
        </div>
      )}

      {query.isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-sf-lg p-4 text-red-400 text-sm">
          Failed to load analytics. Make sure your social integrations are connected.
        </div>
      )}

      {data && (
        <>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
              Overall ({timeframe})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricTile icon={<Eye size={18} />} label="Impressions" value={data.totals.impressions} />
              <MetricTile icon={<Heart size={18} />} label="Likes" value={data.totals.likes} />
              <MetricTile icon={<Share2 size={18} />} label="Shares" value={data.totals.shares} />
              <MetricTile icon={<MessageCircle size={18} />} label="Comments" value={data.totals.comments} />
              <MetricTile icon={<MousePointerClick size={18} />} label="Clicks" value={data.totals.clicks} />
            </div>
          </div>

          {platforms.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
                By Platform
              </h2>
              <div className="space-y-3">
                {platforms.map((platform) => (
                  <PlatformRow
                    key={platform}
                    platform={platform}
                    metrics={data.byPlatform[platform]}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
              Trend
            </h2>
            <TrendChart posts={data.posts} timeframe={timeframe} />
          </div>

          {platforms.length === 0 && (
            <div className="text-center py-12">
              <BarChart2 size={40} className="mx-auto text-sf-text-muted mb-3" />
              <p className="text-sf-text-secondary mb-1">No analytics data yet.</p>
              <p className="text-sm text-sf-text-muted">
                Connect Twitter or LinkedIn in{" "}
                <a
                  href={`/${workspace}/settings/integrations`}
                  className="text-sf-accent hover:underline"
                >
                  Settings → Integrations
                </a>{" "}
                and sync your metrics.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
