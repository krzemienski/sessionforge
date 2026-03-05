"use client";

import { Eye, Heart, Share2, MessageCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricValue {
  current: number;
  previous?: number | null;
}

export interface MetricsCardData {
  impressions: MetricValue;
  likes: MetricValue;
  shares: MetricValue;
  comments: MetricValue;
}

interface MetricsCardProps {
  title?: string;
  icon?: React.ReactNode;
  metrics: MetricsCardData;
  className?: string;
}

function computeTrend(current: number, previous?: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend === null) return null;

  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-sf-success">
        <TrendingUp size={11} />
        {trend}%
      </span>
    );
  }

  if (trend < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-sf-danger">
        <TrendingDown size={11} />
        {Math.abs(trend)}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-sf-text-muted">
      <Minus size={11} />
      0%
    </span>
  );
}

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: MetricValue;
}

function MetricRow({ icon, label, value }: MetricRowProps) {
  const trend = computeTrend(value.current, value.previous);

  return (
    <div className="flex items-center justify-between py-2 border-b border-sf-border last:border-0">
      <div className="flex items-center gap-2 text-sf-text-secondary">
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold font-display text-sf-text-primary">
          {value.current.toLocaleString()}
        </span>
        <TrendBadge trend={trend} />
      </div>
    </div>
  );
}

export function MetricsCard({ title, icon, metrics, className }: MetricsCardProps) {
  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4",
        className
      )}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-3">
          {icon}
          {title && (
            <h3 className="font-semibold text-sf-text-primary font-display text-sm">
              {title}
            </h3>
          )}
        </div>
      )}

      <div>
        <MetricRow
          icon={<Eye size={14} />}
          label="Impressions"
          value={metrics.impressions}
        />
        <MetricRow
          icon={<Heart size={14} />}
          label="Likes"
          value={metrics.likes}
        />
        <MetricRow
          icon={<Share2 size={14} />}
          label="Shares"
          value={metrics.shares}
        />
        <MetricRow
          icon={<MessageCircle size={14} />}
          label="Comments"
          value={metrics.comments}
        />
      </div>
    </div>
  );
}
