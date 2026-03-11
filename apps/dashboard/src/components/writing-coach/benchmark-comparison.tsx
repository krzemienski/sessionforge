"use client";

import { CheckCircle, Type, FileText, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface BenchmarkMetric {
  label: string;
  icon: React.ReactNode;
  userValue: number; // 0-100 scale
  benchmark: number; // 0-100 scale for benchmark threshold
  unit?: string;
  invertGood?: boolean; // true for metrics where lower is better (e.g., passive voice)
}

interface BenchmarkComparisonProps {
  readability: number;
  vocabDiversity: number;
  passiveVoice: number;
  authenticity: number;
  className?: string;
}

function MetricBar({
  metric,
}: {
  metric: BenchmarkMetric;
}) {
  const { label, icon, userValue, benchmark, unit = "%", invertGood = false } = metric;

  // Determine if user is above or below benchmark
  const isAboveBenchmark = invertGood
    ? userValue < benchmark
    : userValue > benchmark;

  const difference = Math.abs(userValue - benchmark);
  const differenceLabel = isAboveBenchmark
    ? `${difference.toFixed(1)}${unit} above benchmark`
    : `${difference.toFixed(1)}${unit} below benchmark`;

  // Calculate bar width percentage (capped at 100%)
  const userBarWidth = Math.min(100, Math.max(0, userValue));

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-sf bg-sf-bg-tertiary text-sf-text-secondary">
            {icon}
          </div>
          <span className="text-sm font-medium text-sf-text-primary">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-display text-sf-text-primary tabular-nums">
            {userValue.toFixed(1)}{unit}
          </span>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-sf",
              isAboveBenchmark
                ? "bg-green-500/20 text-green-400"
                : "bg-yellow-500/20 text-yellow-400"
            )}
          >
            {isAboveBenchmark ? "Above" : "Below"}
          </span>
        </div>
      </div>

      {/* Bar chart container */}
      <div className="relative h-8 bg-sf-bg-tertiary rounded-sf border border-sf-border overflow-hidden">
        {/* User's bar */}
        <div
          className={cn(
            "absolute top-0 left-0 h-full transition-all duration-500 rounded-sf",
            isAboveBenchmark
              ? "bg-green-500/40"
              : "bg-yellow-500/40"
          )}
          style={{ width: `${userBarWidth}%` }}
        />

        {/* Benchmark line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-sf-accent z-10"
          style={{ left: `${Math.min(100, Math.max(0, benchmark))}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-sf-accent border border-sf-bg-primary" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-sf-accent border border-sf-bg-primary" />
        </div>
      </div>

      {/* Benchmark label and difference */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-sf-text-secondary">
          Benchmark: {benchmark.toFixed(0)}{unit}
        </span>
        <span
          className={cn(
            "font-medium",
            isAboveBenchmark ? "text-green-400" : "text-yellow-400"
          )}
        >
          {differenceLabel}
        </span>
      </div>
    </div>
  );
}

export function BenchmarkComparison({
  readability,
  vocabDiversity,
  passiveVoice,
  authenticity,
  className,
}: BenchmarkComparisonProps) {
  const metrics: BenchmarkMetric[] = [
    {
      label: "Readability",
      icon: <BookOpen size={16} />,
      userValue: readability,
      benchmark: 75,
      unit: "",
    },
    {
      label: "Vocabulary Diversity",
      icon: <Type size={16} />,
      userValue: vocabDiversity,
      benchmark: 65,
    },
    {
      label: "Passive Voice",
      icon: <FileText size={16} />,
      userValue: passiveVoice,
      benchmark: 15,
      invertGood: true, // Lower is better for passive voice
    },
    {
      label: "Authenticity",
      icon: <CheckCircle size={16} />,
      userValue: authenticity,
      benchmark: 75,
    },
  ];

  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-6",
        className
      )}
    >
      <div>
        <h3 className="font-semibold text-sf-text-primary font-display text-sm mb-1">
          Benchmark Comparison
        </h3>
        <p className="text-xs text-sf-text-secondary">
          Your writing metrics compared to high-performing developer content
        </p>
      </div>

      <div className="space-y-5">
        {metrics.map((metric) => (
          <MetricBar key={metric.label} metric={metric} />
        ))}
      </div>
    </div>
  );
}
