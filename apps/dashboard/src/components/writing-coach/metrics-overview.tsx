"use client";

import { TrendingUp, TrendingDown, CheckCircle, Type, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricData {
  value: number;
  trend: "up" | "down" | "neutral";
  benchmark: number; // 0-100 scale for benchmark bar
}

interface MetricsOverviewProps {
  authenticityScore: MetricData & { grade: string };
  vocabDiversity: MetricData;
  passiveVoice: MetricData;
  aiPatternHits: MetricData & { total: number };
}

function getGradeBadgeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "B":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "C":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "D":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "F":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-sf-bg-tertiary text-sf-text-secondary border-sf-border";
  }
}

function TrendArrow({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "neutral") return null;

  return trend === "up" ? (
    <TrendingUp size={16} className="text-green-400" />
  ) : (
    <TrendingDown size={16} className="text-red-400" />
  );
}

function BenchmarkBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full bg-sf-bg-tertiary rounded-sf h-1.5 overflow-hidden mt-2">
      <div
        className={cn(
          "h-full transition-all duration-300",
          percentage >= 80 ? "bg-green-500" :
          percentage >= 60 ? "bg-blue-500" :
          percentage >= 40 ? "bg-yellow-500" :
          "bg-red-500"
        )}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  trend,
  benchmark,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  benchmark: number;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-sf bg-sf-bg-tertiary text-sf-text-secondary">
            {icon}
          </div>
          <div>
            <p className="text-xs text-sf-text-secondary">{label}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xl font-bold font-display text-sf-text-primary">
                {value}
              </p>
              {badge}
            </div>
          </div>
        </div>
        <TrendArrow trend={trend} />
      </div>
      <BenchmarkBar percentage={benchmark} />
    </div>
  );
}

export function MetricsOverview({
  authenticityScore,
  vocabDiversity,
  passiveVoice,
  aiPatternHits,
}: MetricsOverviewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricTile
        icon={<CheckCircle size={18} />}
        label="Avg Authenticity Score"
        value={authenticityScore.value.toFixed(1)}
        trend={authenticityScore.trend}
        benchmark={authenticityScore.benchmark}
        badge={
          <span
            className={cn(
              "px-2 py-0.5 rounded-sf text-xs font-bold border",
              getGradeBadgeColor(authenticityScore.grade)
            )}
          >
            {authenticityScore.grade}
          </span>
        }
      />

      <MetricTile
        icon={<Type size={18} />}
        label="Vocab Diversity"
        value={`${vocabDiversity.value.toFixed(1)}%`}
        trend={vocabDiversity.trend}
        benchmark={vocabDiversity.benchmark}
      />

      <MetricTile
        icon={<FileText size={18} />}
        label="Passive Voice"
        value={`${passiveVoice.value.toFixed(1)}%`}
        trend={passiveVoice.trend}
        benchmark={passiveVoice.benchmark}
      />

      <MetricTile
        icon={<AlertTriangle size={18} />}
        label="AI Pattern Hits"
        value={aiPatternHits.total.toLocaleString()}
        trend={aiPatternHits.trend}
        benchmark={aiPatternHits.benchmark}
      />
    </div>
  );
}
