"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PeriodDeltaBadgeProps {
  /** Current period value */
  current: number;
  /** Previous period value for comparison */
  previous?: number | null;
  /** Pre-computed delta percentage (overrides current/previous calculation) */
  delta?: number | null;
  /** Additional CSS classes */
  className?: string;
}

function computeDelta(current: number, previous?: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Displays a period-over-period percentage change badge with directional
 * arrow and color coding: green for positive, red for negative, muted for zero.
 */
export function PeriodDeltaBadge({
  current,
  previous,
  delta: deltaProp,
  className,
}: PeriodDeltaBadgeProps) {
  const delta = deltaProp !== undefined ? deltaProp : computeDelta(current, previous);

  if (delta === null) return null;

  if (delta > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs font-medium text-sf-success",
          className
        )}
      >
        <ArrowUp size={11} />
        {delta}%
      </span>
    );
  }

  if (delta < 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs font-medium text-sf-danger",
          className
        )}
      >
        <ArrowDown size={11} />
        {Math.abs(delta)}%
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium text-sf-text-muted",
        className
      )}
    >
      <Minus size={11} />
      0%
    </span>
  );
}
