"use client";

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignificanceLevel } from "@/lib/experiments/statistics";

interface WinnerBadgeProps {
  confidence: SignificanceLevel;
  winnerLabel: string | null;
  kpiValue?: number | null;
  kpiName?: string;
  size?: "sm" | "md";
  className?: string;
}

const confidenceConfig: Record<
  SignificanceLevel,
  { label: string; bg: string; text: string; icon: string }
> = {
  not_significant: {
    label: "Not significant",
    bg: "bg-sf-bg-tertiary",
    text: "text-sf-text-muted",
    icon: "text-sf-text-muted",
  },
  low_confidence: {
    label: "Low confidence",
    bg: "bg-yellow-500/10",
    text: "text-yellow-600 dark:text-yellow-400",
    icon: "text-yellow-500",
  },
  medium_confidence: {
    label: "Medium confidence",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    icon: "text-blue-500",
  },
  high_confidence: {
    label: "High confidence",
    bg: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    icon: "text-green-500",
  },
};

function formatKpiValue(value: number, kpiName?: string): string {
  if (kpiName === "engagementRate" || kpiName === "engagement_rate") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

export function WinnerBadge({
  confidence,
  winnerLabel,
  kpiValue,
  kpiName,
  size = "sm",
  className,
}: WinnerBadgeProps) {
  const config = confidenceConfig[confidence];
  const isSmall = size === "sm";

  if (!winnerLabel) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-sf-border",
          config.bg,
          isSmall ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
          className
        )}
      >
        <Trophy
          size={isSmall ? 10 : 12}
          className="text-sf-text-muted flex-shrink-0"
        />
        <span className="text-sf-text-muted">No winner yet</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-sf-border",
        config.bg,
        isSmall ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      <Trophy size={isSmall ? 10 : 12} className={cn(config.icon, "flex-shrink-0")} />
      <span className={cn("font-medium", config.text)}>{winnerLabel}</span>
      {kpiValue != null && (
        <>
          <span className="text-sf-text-muted">·</span>
          <span className="text-sf-text-secondary">
            {formatKpiValue(kpiValue, kpiName)}
          </span>
        </>
      )}
      <span
        className={cn(
          "rounded-full border border-sf-border px-1.5 py-px font-medium",
          isSmall ? "text-[10px]" : "text-xs",
          config.bg,
          config.text
        )}
      >
        {config.label}
      </span>
    </span>
  );
}
