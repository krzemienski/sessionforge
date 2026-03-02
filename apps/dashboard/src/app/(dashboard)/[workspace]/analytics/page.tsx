"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart2, Eye, Heart, MessageCircle, ThumbsUp, RefreshCw, Trophy, ExternalLink, Settings, ChevronDown, Save } from "lucide-react";
import { cn } from "@/lib/utils";

const TIME_WINDOWS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const PLATFORM_COLORS: Record<string, string> = {
  devto: "text-blue-400 bg-blue-400/10",
  hashnode: "text-purple-400 bg-purple-400/10",
  manual: "text-yellow-400 bg-yellow-400/10",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog",
  twitter_thread: "Twitter",
  linkedin_post: "LinkedIn",
  changelog: "Changelog",
  newsletter: "Newsletter",
  devto_post: "Dev.to",
  custom: "Custom",
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-sf-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-sf-text-secondary font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold font-display text-sf-text-primary">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-2 text-xs">
      <p className="text-sf-text-secondary mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function formatChartDate(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeek(weekStr: string) {
  if (!weekStr) return "";
  const date = new Date(weekStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();
  const [window, setWindow] = useState(30);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devtoApiKey, setDevtoApiKey] = useState("");
  const [devtoUsername, setDevtoUsername] = useState("");
  const [hashnodeApiKey, setHashnodeApiKey] = useState("");
  const [hashnodeUsername, setHashnodeUsername] = useState("");

  const metrics = useQuery({
    queryKey: ["analytics-metrics", workspace, window],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/metrics?workspace=${workspace}&window=${window}`);
      if (!res.ok) throw new Error("Failed to load metrics");
      return res.json();
    },
  });

  const platformSettingsQuery = useQuery({
    queryKey: ["analytics-platform-settings", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/platform-settings?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load platform settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (platformSettingsQuery.data) {
      setDevtoUsername(platformSettingsQuery.data.devtoUsername ?? "");
      setHashnodeUsername(platformSettingsQuery.data.hashnodeUsername ?? "");
    }
  }, [platformSettingsQuery.data]);

  const savePlatformSettings = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/analytics/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analytics-platform-settings"] });
      setDevtoApiKey("");
      setHashnodeApiKey("");
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/analytics/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analytics-metrics"] });
    },
  });

  const data = metrics.data;
  const hasData =
    data &&
    (data.totalViews > 0 ||
      data.totalReactions > 0 ||
      data.timeSeriesData?.length > 0);

  const contentTypeData = (data?.contentTypeBreakdown ?? []).map((row: any) => ({
    name: CONTENT_TYPE_LABELS[row.contentType ?? ""] || row.contentType || row.platform,
    views: row.totalViews,
    reactions: row.totalReactions + row.totalLikes,
    posts: row.postCount,
  }));

  const cadenceData = (data?.publishingCadence ?? []).map((row: any) => ({
    week: formatWeek(row.week),
    posts: Number(row.postsPublished),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Analytics</h1>
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={sync.isPending ? "animate-spin" : ""} />
          {sync.isPending ? "Syncing..." : "Sync Now"}
        </button>
      </div>

      {/* Time window tabs */}
      <div className="flex gap-2 mb-6">
        {TIME_WINDOWS.map((tw) => (
          <button
            key={tw.value}
            onClick={() => setWindow(tw.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-sf transition-colors",
              window === tw.value
                ? "bg-sf-accent-bg text-sf-accent"
                : "text-sf-text-secondary hover:bg-sf-bg-hover"
            )}
          >
            {tw.label}
          </button>
        ))}
      </div>

      {sync.isSuccess && (
        <div className="bg-sf-accent-bg border border-sf-accent/20 rounded-sf-lg p-4 mb-6">
          <p className="text-sf-accent text-sm">
            Sync complete — Dev.to: {sync.data?.devto?.synced ?? 0} posts
            {sync.data?.devto?.cached ? " (cached)" : ""}, Hashnode:{" "}
            {sync.data?.hashnode?.synced ?? 0} posts
            {sync.data?.hashnode?.cached ? " (cached)" : ""}
          </p>
        </div>
      )}

      {sync.isError && (
        <div className="bg-sf-danger/10 border border-sf-danger/20 rounded-sf-lg p-4 mb-6">
          <p className="text-sf-danger text-sm">Sync failed. Check your platform API keys in Settings.</p>
        </div>
      )}

      {/* Overview stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Eye} label="Views" value={data?.totalViews ?? 0} color="text-sf-accent" />
        <StatCard icon={Heart} label="Reactions" value={data?.totalReactions ?? 0} color="text-red-400" />
        <StatCard icon={MessageCircle} label="Comments" value={data?.totalComments ?? 0} color="text-sf-info" />
        <StatCard icon={ThumbsUp} label="Likes" value={data?.totalLikes ?? 0} color="text-purple-400" />
      </div>

      {!hasData && !metrics.isLoading && (
        <div className="text-center py-16 bg-sf-bg-secondary border border-sf-border rounded-sf-lg mb-8">
          <BarChart2 size={48} className="mx-auto text-sf-text-muted mb-4" />
          <h2 className="text-lg font-semibold text-sf-text-primary mb-2">No metrics yet</h2>
          <p className="text-sf-text-secondary mb-6">
            Connect your Dev.to or Hashnode API keys in Settings, then sync to pull your content metrics.
          </p>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="bg-sf-accent text-sf-bg-primary px-6 py-2.5 rounded-sf font-medium hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={cn("inline mr-2", sync.isPending && "animate-spin")} />
            Sync Now
          </button>
        </div>
      )}

      {hasData && (
        <>
          {/* Trend line chart */}
          {data.timeSeriesData?.length > 0 && (
            <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-sf-lg mb-6">
              <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-4">
                Engagement Trend
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.timeSeriesData.map((d: any) => ({ ...d, date: formatChartDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#555555", fontSize: 11 }}
                    axisLine={{ stroke: "#2A2A2A" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#555555", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#888888", paddingTop: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#00FF88"
                    strokeWidth={2}
                    dot={false}
                    name="Views"
                  />
                  <Line
                    type="monotone"
                    dataKey="reactions"
                    stroke="#4488FF"
                    strokeWidth={2}
                    dot={false}
                    name="Reactions"
                  />
                  <Line
                    type="monotone"
                    dataKey="comments"
                    stroke="#FFAA00"
                    strokeWidth={2}
                    dot={false}
                    name="Comments"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Content type breakdown */}
            {contentTypeData.length > 0 && (
              <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-sf-lg">
                <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-4">
                  Content Type Breakdown
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={contentTypeData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#555555", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#555555", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="views" fill="#00FF88" name="Views" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="reactions" fill="#4488FF" name="Reactions" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Publishing cadence chart */}
            {cadenceData.length > 0 && (
              <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-sf-lg">
                <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-4">
                  Publishing Cadence
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={cadenceData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: "#555555", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#555555", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="posts" fill="#00CC6A" name="Posts Published" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Best performers list */}
          {data.topPosts?.length > 0 && (
            <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-sf-lg">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={16} className="text-sf-warning" />
                <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide">
                  Best Performers
                </h2>
              </div>
              <div className="space-y-3">
                {data.topPosts.map((post: any, index: number) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 p-3 bg-sf-bg-tertiary rounded-sf"
                  >
                    <span className="text-sf-text-muted font-display text-sm w-5 flex-shrink-0">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-sf-full text-xs font-medium",
                            PLATFORM_COLORS[post.platform] ?? "text-sf-text-secondary bg-sf-bg-hover"
                          )}
                        >
                          {post.platform}
                        </span>
                        {post.url && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sf-text-muted hover:text-sf-accent transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <p className="text-sm font-medium text-sf-text-primary truncate">{post.title}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 text-xs text-sf-text-secondary">
                      <span className="flex items-center gap-1">
                        <Eye size={12} className="text-sf-accent" />
                        {(post.views ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={12} className="text-red-400" />
                        {((post.reactions ?? 0) + (post.likes ?? 0)).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} className="text-sf-info" />
                        {(post.comments ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Platform Settings */}
      <div className="mt-8 bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden">
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-sf-bg-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-sf-text-secondary" />
            <span className="text-sm font-semibold text-sf-text-primary">Platform Settings</span>
            <div className="flex items-center gap-2 ml-2">
              {platformSettingsQuery.data?.devtoConnected && (
                <span className="px-2 py-0.5 rounded-sf-full text-xs font-medium text-blue-400 bg-blue-400/10">
                  Dev.to connected
                </span>
              )}
              {platformSettingsQuery.data?.hashnodeConnected && (
                <span className="px-2 py-0.5 rounded-sf-full text-xs font-medium text-purple-400 bg-purple-400/10">
                  Hashnode connected
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "text-sf-text-secondary transition-transform",
              settingsOpen && "rotate-180"
            )}
          />
        </button>

        {settingsOpen && (
          <div className="px-6 pb-6 border-t border-sf-border space-y-6 pt-5">
            {/* Dev.to */}
            <div>
              <h3 className="text-xs font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
                Dev.to
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={devtoApiKey}
                    onChange={(e) => setDevtoApiKey(e.target.value)}
                    placeholder={
                      platformSettingsQuery.data?.devtoConnected
                        ? platformSettingsQuery.data.devtoApiKey ?? "••••••••••••"
                        : "Enter Dev.to API key"
                    }
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={devtoUsername}
                    onChange={(e) => setDevtoUsername(e.target.value)}
                    placeholder="your-username"
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus"
                  />
                </div>
              </div>
            </div>

            {/* Hashnode */}
            <div>
              <h3 className="text-xs font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
                Hashnode
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={hashnodeApiKey}
                    onChange={(e) => setHashnodeApiKey(e.target.value)}
                    placeholder={
                      platformSettingsQuery.data?.hashnodeConnected
                        ? platformSettingsQuery.data.hashnodeApiKey ?? "••••••••••••"
                        : "Enter Hashnode API key"
                    }
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={hashnodeUsername}
                    onChange={(e) => setHashnodeUsername(e.target.value)}
                    placeholder="your-username"
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  savePlatformSettings.mutate({
                    workspaceSlug: workspace,
                    devtoApiKey: devtoApiKey || undefined,
                    devtoUsername: devtoUsername || undefined,
                    hashnodeApiKey: hashnodeApiKey || undefined,
                    hashnodeUsername: hashnodeUsername || undefined,
                  })
                }
                disabled={savePlatformSettings.isPending}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {savePlatformSettings.isPending ? "Saving..." : "Save Settings"}
              </button>

              {savePlatformSettings.isSuccess && (
                <p className="text-sm text-sf-success">Settings saved.</p>
              )}
              {savePlatformSettings.isError && (
                <p className="text-sm text-sf-danger">Failed to save settings.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
