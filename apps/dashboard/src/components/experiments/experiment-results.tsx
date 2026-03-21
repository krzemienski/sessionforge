"use client";

import { RefreshCw, Award } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { WinnerBadge } from "@/components/experiments/winner-badge";
import {
  useExperimentWinner,
  usePromoteWinner,
} from "@/hooks/use-experiments";
import type { ExperimentKpi, SignificanceLevel } from "@/lib/experiments/statistics";

// ── Types ────────────────────────────────────────────────────────────────────

interface VariantStat {
  variantId: string;
  label: string;
  metricValue: number;
  sampleSize: number;
  rate: number;
}

interface WinnerData {
  winner: string | null;
  confidence: SignificanceLevel;
  pValue: number | null;
  variantStats: VariantStat[];
  minimumSampleReached: boolean;
}

interface ExperimentResultsProps {
  experimentId: string;
  kpi: ExperimentKpi;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const KPI_LABELS: Record<ExperimentKpi, string> = {
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  engagement_rate: "Engagement Rate",
};

const VARIANT_COLORS = ["#00FF88", "#4488FF", "#FFAA00", "#CC88FF", "#FF6B6B"];

function formatRate(rate: number, _kpi: ExperimentKpi): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatMetricValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExperimentResults({
  experimentId,
  kpi,
  className,
}: ExperimentResultsProps) {
  const { data, isLoading, isError } = useExperimentWinner(experimentId);
  const promote = usePromoteWinner();

  const winnerData = data as WinnerData | undefined;

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-sf-text-secondary", className)}>
        <RefreshCw size={20} className="animate-spin mr-2" />
        Loading results...
      </div>
    );
  }

  if (isError || !winnerData) {
    return (
      <div className={cn("bg-red-500/10 border border-red-500/30 rounded-sf-lg p-4 text-red-400 text-sm", className)}>
        Failed to load experiment results. Please try again later.
      </div>
    );
  }

  const { variantStats, confidence, winner, pValue, minimumSampleReached } = winnerData;
  const winnerStat = variantStats.find((v) => v.variantId === winner);

  // Chart data sorted by rate descending for visual clarity
  const chartData = variantStats
    .map((v) => ({
      label: v.label,
      rate: v.rate,
      metricValue: v.metricValue,
      sampleSize: v.sampleSize,
      isWinner: v.variantId === winner,
    }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Winner suggestion */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sf bg-sf-bg-tertiary text-sf-text-secondary">
              <Award size={18} />
            </div>
            <div>
              <p className="text-xs text-sf-text-secondary uppercase tracking-wide mb-1">
                Winner Suggestion
              </p>
              <WinnerBadge
                confidence={confidence}
                winnerLabel={winnerStat?.label ?? null}
                kpiValue={winnerStat?.rate ?? null}
                kpiName={kpi}
                size="md"
              />
            </div>
          </div>
          {winner && confidence !== "not_significant" && (
            <button
              onClick={() =>
                promote.mutate({ experimentId, variantId: winner })
              }
              disabled={promote.isPending}
              className={cn(
                "px-4 py-2 rounded-sf text-sm font-medium transition-colors",
                "bg-sf-accent text-white hover:bg-sf-accent/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {promote.isPending ? "Promoting..." : "Promote Winner"}
            </button>
          )}
        </div>
        {promote.isError && (
          <p className="mt-2 text-xs text-red-400">
            {promote.error?.message ?? "Failed to promote winner"}
          </p>
        )}
        {!minimumSampleReached && (
          <p className="mt-2 text-xs text-sf-text-muted">
            Minimum sample size not yet reached. Results may change as more data is collected.
          </p>
        )}
        {pValue != null && minimumSampleReached && (
          <p className="mt-2 text-xs text-sf-text-muted">
            p-value: {pValue.toFixed(4)}
          </p>
        )}
      </div>

      {/* Comparison table */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-sf-border">
          <h3 className="text-sm font-semibold text-sf-text-primary font-display">
            Variant Comparison
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sf-border text-left">
                <th className="px-4 py-2 text-xs font-medium text-sf-text-secondary uppercase tracking-wide">
                  Variant
                </th>
                <th className="px-4 py-2 text-xs font-medium text-sf-text-secondary uppercase tracking-wide text-right">
                  Impressions
                </th>
                <th className="px-4 py-2 text-xs font-medium text-sf-text-secondary uppercase tracking-wide text-right">
                  {KPI_LABELS[kpi]}
                </th>
                <th className="px-4 py-2 text-xs font-medium text-sf-text-secondary uppercase tracking-wide text-right">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {variantStats.map((v, idx) => (
                <tr
                  key={v.variantId}
                  className={cn(
                    "border-b border-sf-border last:border-b-0",
                    v.variantId === winner && "bg-green-500/5"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: VARIANT_COLORS[idx % VARIANT_COLORS.length] }}
                      />
                      <span className="font-medium text-sf-text-primary">
                        {v.label}
                      </span>
                      {v.variantId === winner && (
                        <span className="text-[10px] px-1.5 py-px rounded-full bg-green-500/10 text-green-500 font-medium">
                          Winner
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sf-text-primary tabular-nums">
                    {formatMetricValue(v.sampleSize)}
                  </td>
                  <td className="px-4 py-3 text-right text-sf-text-primary tabular-nums">
                    {formatMetricValue(v.metricValue)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-sf-text-primary tabular-nums">
                    {formatRate(v.rate, kpi)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
          <h3 className="text-sm font-semibold text-sf-text-primary font-display mb-4">
            {KPI_LABELS[kpi]} Rate by Variant
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sf-border, #333)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--sf-text-secondary, #999)" }}
                axisLine={{ stroke: "var(--sf-border, #333)" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 12, fill: "var(--sf-text-secondary, #999)" }}
                axisLine={{ stroke: "var(--sf-border, #333)" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--sf-bg-secondary, #1a1a1a)",
                  border: "1px solid var(--sf-border, #333)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [formatRate(value, kpi), "Rate"]}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={64}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.label}
                    fill={
                      entry.isWinner
                        ? "#00FF88"
                        : VARIANT_COLORS[index % VARIANT_COLORS.length]
                    }
                    fillOpacity={entry.isWinner ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
