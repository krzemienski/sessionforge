"use client";

import { Eye, Heart, Share2, MessageCircle, MousePointerClick, Trophy, Twitter, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricTotals {
  impressions: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
}

interface PlatformComparisonProps {
  byPlatform: Record<string, MetricTotals>;
  className?: string;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter size={14} className="text-sky-400" />,
  linkedin: <Linkedin size={14} className="text-blue-500" />,
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "border-sky-500/30 bg-sky-500/5",
  linkedin: "border-blue-500/30 bg-blue-500/5",
};

const METRICS: {
  key: keyof MetricTotals;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "impressions", label: "Impressions", icon: <Eye size={13} /> },
  { key: "likes", label: "Likes", icon: <Heart size={13} /> },
  { key: "shares", label: "Shares", icon: <Share2 size={13} /> },
  { key: "comments", label: "Comments", icon: <MessageCircle size={13} /> },
  { key: "clicks", label: "Clicks", icon: <MousePointerClick size={13} /> },
];

function getBestPlatform(
  byPlatform: Record<string, MetricTotals>,
  metricKey: keyof MetricTotals
): string | null {
  const platforms = Object.keys(byPlatform);
  if (platforms.length < 2) return null;

  let best: string | null = null;
  let bestVal = -1;

  for (const platform of platforms) {
    const val = byPlatform[platform][metricKey];
    if (val > bestVal) {
      bestVal = val;
      best = platform;
    }
  }

  return best;
}

function computeEngagementRate(metrics: MetricTotals): number {
  if (metrics.impressions === 0) return 0;
  const engagements = metrics.likes + metrics.shares + metrics.comments + metrics.clicks;
  return (engagements / metrics.impressions) * 100;
}

function getBestOverallPlatform(
  byPlatform: Record<string, MetricTotals>
): string | null {
  const platforms = Object.keys(byPlatform);
  if (platforms.length < 2) return null;

  let best: string | null = null;
  let bestRate = -1;

  for (const platform of platforms) {
    const rate = computeEngagementRate(byPlatform[platform]);
    if (rate > bestRate) {
      bestRate = rate;
      best = platform;
    }
  }

  return best;
}

interface MetricComparisonRowProps {
  icon: React.ReactNode;
  label: string;
  platforms: string[];
  byPlatform: Record<string, MetricTotals>;
  metricKey: keyof MetricTotals;
}

function MetricComparisonRow({
  icon,
  label,
  platforms,
  byPlatform,
  metricKey,
}: MetricComparisonRowProps) {
  const best = getBestPlatform(byPlatform, metricKey);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-sf-border last:border-0 gap-1.5 sm:gap-3">
      <div className="flex items-center gap-1.5 text-sf-text-secondary sm:w-28 flex-shrink-0">
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-1">
        {platforms.map((platform) => {
          const value = byPlatform[platform]?.[metricKey] ?? 0;
          const isBest = platform === best;
          return (
            <div
              key={platform}
              className={cn(
                "flex-1 flex items-center justify-between px-2 py-1 rounded-sf",
                isBest
                  ? "bg-sf-success/10 border border-sf-success/20"
                  : "bg-sf-bg-tertiary border border-transparent"
              )}
            >
              <div className="flex items-center gap-1">
                {PLATFORM_ICONS[platform]}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold font-display text-sf-text-primary">
                  {value.toLocaleString()}
                </span>
                {isBest && <Trophy size={10} className="text-sf-success flex-shrink-0" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlatformComparison({ byPlatform, className }: PlatformComparisonProps) {
  const platforms = Object.keys(byPlatform);

  if (platforms.length === 0) {
    return (
      <div
        className={cn(
          "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4",
          className
        )}
      >
        <h3 className="font-semibold text-sf-text-primary font-display text-sm mb-3">
          Platform Comparison
        </h3>
        <p className="text-sm text-sf-text-muted text-center py-4">
          No platform data available.
        </p>
      </div>
    );
  }

  const bestOverall = getBestOverallPlatform(byPlatform);

  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h3 className="font-semibold text-sf-text-primary font-display text-sm">
          Platform Comparison
        </h3>
        {bestOverall && (
          <div className="flex items-center gap-1.5 text-xs text-sf-success">
            <Trophy size={12} />
            <span>
              {PLATFORM_LABELS[bestOverall] ?? bestOverall} leads in engagement
            </span>
          </div>
        )}
      </div>

      {/* Platform header cards */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 mb-4 sm:pl-[7.75rem]">
        {platforms.map((platform) => {
          const engRate = computeEngagementRate(byPlatform[platform]);
          const isBest = platform === bestOverall;
          return (
            <div
              key={platform}
              className={cn(
                "flex-1 rounded-sf-lg border p-3",
                isBest
                  ? PLATFORM_COLORS[platform] ?? "border-sf-border-focus bg-sf-bg-tertiary"
                  : "border-sf-border bg-sf-bg-tertiary"
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {PLATFORM_ICONS[platform]}
                <span className="text-xs font-semibold text-sf-text-primary">
                  {PLATFORM_LABELS[platform] ?? platform}
                </span>
                {isBest && <Trophy size={11} className="text-sf-success ml-auto" />}
              </div>
              <p className="text-xs text-sf-text-muted">
                {engRate.toFixed(2)}% engagement
              </p>
            </div>
          );
        })}
      </div>

      {/* Metric rows */}
      <div>
        {METRICS.map((m) => (
          <MetricComparisonRow
            key={m.key}
            icon={m.icon}
            label={m.label}
            platforms={platforms}
            byPlatform={byPlatform}
            metricKey={m.key}
          />
        ))}
      </div>
    </div>
  );
}
