"use client";

import { Eye, MousePointerClick, Activity, FileText, Twitter, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeriodDeltaBadge } from "@/components/analytics/period-delta-badge";

export interface ChannelRoiData {
  platform: string;
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
  /** Deltas as fractions (e.g. 0.15 = +15%) */
  deltas: {
    impressions: number | null;
    clicks: number | null;
    engagementRate: number | null;
    publishCount: number | null;
  };
}

interface ChannelRoiCardProps {
  data: ChannelRoiData;
  className?: string;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter size={16} className="text-sky-400" />,
  linkedin: <Linkedin size={16} className="text-blue-500" />,
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
};

const PLATFORM_ACCENT: Record<string, string> = {
  twitter: "border-sky-500/30",
  linkedin: "border-blue-500/30",
};

/** Convert a fraction delta (0.15) to an integer percentage (15) for PeriodDeltaBadge. */
function fractionToPercent(delta: number | null): number | null {
  if (delta === null) return null;
  return Math.round(delta * 100);
}

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  deltaPercent: number | null;
}

function MetricRow({ icon, label, value, deltaPercent }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-sf-border last:border-0">
      <div className="flex items-center gap-2 text-sf-text-secondary">
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold font-display text-sf-text-primary">{value}</span>
        <PeriodDeltaBadge current={1} delta={deltaPercent} />
      </div>
    </div>
  );
}

export function ChannelRoiCard({ data, className }: ChannelRoiCardProps) {
  const { platform, current, deltas } = data;

  const accentBorder = PLATFORM_ACCENT[platform] ?? "border-sf-border";
  const icon = PLATFORM_ICONS[platform];
  const label = PLATFORM_LABELS[platform] ?? platform;

  const engagementDisplay = `${(current.engagementRate * 100).toFixed(2)}%`;

  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border rounded-sf-lg p-4",
        accentBorder,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold text-sf-text-primary font-display text-sm">{label}</h3>
      </div>

      {/* Metric rows */}
      <div>
        <MetricRow
          icon={<Eye size={14} />}
          label="Impressions"
          value={current.impressions.toLocaleString()}
          deltaPercent={fractionToPercent(deltas.impressions)}
        />
        <MetricRow
          icon={<MousePointerClick size={14} />}
          label="Clicks"
          value={current.clicks.toLocaleString()}
          deltaPercent={fractionToPercent(deltas.clicks)}
        />
        <MetricRow
          icon={<Activity size={14} />}
          label="Engagement Rate"
          value={engagementDisplay}
          deltaPercent={fractionToPercent(deltas.engagementRate)}
        />
        <MetricRow
          icon={<FileText size={14} />}
          label="Published"
          value={current.publishCount.toLocaleString()}
          deltaPercent={fractionToPercent(deltas.publishCount)}
        />
      </div>
    </div>
  );
}
