"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricKey = "avgAuthenticityScore" | "avgReadability";

interface TrendDataPoint {
  date: string;
  avgAuthenticityScore: number;
  avgReadability: number;
}

interface AuthenticityTrendChartProps {
  trendData: TrendDataPoint[];
  className?: string;
}

const METRICS: { key: MetricKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "avgAuthenticityScore", label: "Authenticity", icon: <Sparkles size={12} />, color: "#00FF88" },
  { key: "avgReadability", label: "Readability", icon: <BookOpen size={12} />, color: "#4488FF" },
];

function buildPath(
  values: number[],
  maxVal: number,
  width: number,
  height: number,
  padX: number,
  padY: number
): string {
  if (values.length < 2) return "";
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const safeMax = maxVal === 0 ? 1 : maxVal;

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * usableW;
    const y = padY + usableH - (v / safeMax) * usableH;
    return `${x},${y}`;
  });

  return `M ${points.join(" L ")}`;
}

function buildAreaPath(
  values: number[],
  maxVal: number,
  width: number,
  height: number,
  padX: number,
  padY: number
): string {
  if (values.length < 2) return "";
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const safeMax = maxVal === 0 ? 1 : maxVal;
  const bottomY = padY + usableH;

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * usableW;
    const y = padY + usableH - (v / safeMax) * usableH;
    return { x, y };
  });

  const linePart = points.map((p) => `${p.x},${p.y}`).join(" L ");
  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;

  return `M ${firstX},${bottomY} L ${linePart} L ${lastX},${bottomY} Z`;
}

interface TooltipData {
  x: number;
  y: number;
  dataPoint: TrendDataPoint;
  metric: MetricKey;
}

const SVG_W = 600;
const SVG_H = 200;
const PAD_X = 40;
const PAD_Y = 16;
const BENCHMARK_SCORE = 75;

export function AuthenticityTrendChart({ trendData, className }: AuthenticityTrendChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("avgAuthenticityScore");
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const values = trendData.map((d) => d[activeMetric]);
  // For authenticity scores, we want a fixed scale from 0-100
  // But if all values are 0, use 1 to avoid division by zero
  const actualMax = Math.max(...values, 0);
  const maxVal = actualMax === 0 ? 1 : 100;

  const metricConfig = METRICS.find((m) => m.key === activeMetric)!;
  const linePath = buildPath(values, maxVal, SVG_W, SVG_H, PAD_X, PAD_Y);
  const areaPath = buildAreaPath(values, maxVal, SVG_W, SVG_H, PAD_X, PAD_Y);

  // Y-axis ticks (0, 25, 50, 75, 100)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    value: Math.round(frac * maxVal),
    y: PAD_Y + (SVG_H - PAD_Y * 2) * (1 - frac),
  }));

  // Calculate benchmark line Y position
  const benchmarkY = PAD_Y + (SVG_H - PAD_Y * 2) * (1 - BENCHMARK_SCORE / maxVal);

  // X-axis label interval
  const xLabelInterval = trendData.length <= 7 ? 1 : trendData.length <= 30 ? 5 : 15;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * SVG_W;
      const usableW = SVG_W - PAD_X * 2;
      const idx = Math.round(
        ((mouseX - PAD_X) / usableW) * (trendData.length - 1)
      );
      const clampedIdx = Math.max(0, Math.min(trendData.length - 1, idx));
      const dataPoint = trendData[clampedIdx];
      const val = dataPoint[activeMetric];
      const x = PAD_X + (clampedIdx / (trendData.length - 1)) * usableW;
      const y = PAD_Y + (SVG_H - PAD_Y * 2) * (1 - val / maxVal);
      setTooltip({ x, y, dataPoint, metric: activeMetric });
    },
    [trendData, activeMetric, maxVal]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const isEmpty = trendData.length === 0;

  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sf-text-primary font-display text-sm">
          Writing Quality Trend
        </h3>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-sf text-xs font-medium transition-colors",
                activeMetric === m.key
                  ? "bg-sf-bg-tertiary text-sf-text-primary border border-sf-border-focus"
                  : "text-sf-text-secondary hover:text-sf-text-primary"
              )}
            >
              <span style={{ color: m.color }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ aspectRatio: `${SVG_W}/${SVG_H + 24}` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H + 24}`}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={`area-grad-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metricConfig.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={metricConfig.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PAD_X}
                y1={tick.y}
                x2={SVG_W - PAD_X}
                y2={tick.y}
                stroke="#2A2A2A"
                strokeWidth="1"
              />
              <text
                x={PAD_X - 6}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="9"
                fill="#555555"
              >
                {tick.value}
              </text>
            </g>
          ))}

          {/* Benchmark line at 75 */}
          <line
            x1={PAD_X}
            y1={benchmarkY}
            x2={SVG_W - PAD_X}
            y2={benchmarkY}
            stroke="#FFAA00"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <text
            x={SVG_W - PAD_X - 4}
            y={benchmarkY - 4}
            textAnchor="end"
            fontSize="9"
            fill="#FFAA00"
            opacity="0.8"
          >
            Benchmark (75)
          </text>

          {/* X-axis labels */}
          {trendData.map((d, i) => {
            if (i % xLabelInterval !== 0 && i !== trendData.length - 1) return null;
            const x =
              PAD_X + (i / (trendData.length - 1)) * (SVG_W - PAD_X * 2);
            const dateLabel = new Date(d.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return (
              <text
                key={i}
                x={x}
                y={SVG_H + 16}
                textAnchor="middle"
                fontSize="9"
                fill="#555555"
              >
                {dateLabel}
              </text>
            );
          })}

          {isEmpty ? (
            <text
              x={SVG_W / 2}
              y={SVG_H / 2}
              textAnchor="middle"
              fontSize="12"
              fill="#555555"
            >
              No data for this period
            </text>
          ) : (
            <>
              {/* Area fill */}
              <path
                d={areaPath}
                fill={`url(#area-grad-${activeMetric})`}
              />

              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke={metricConfig.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points - only show for sparse data */}
              {trendData.length <= 14 &&
                trendData.map((d, i) => {
                  const val = d[activeMetric];
                  const x =
                    PAD_X +
                    (i / (trendData.length - 1)) * (SVG_W - PAD_X * 2);
                  const y =
                    PAD_Y +
                    (SVG_H - PAD_Y * 2) * (1 - val / maxVal);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="3"
                      fill={metricConfig.color}
                      stroke="#111111"
                      strokeWidth="1.5"
                    />
                  );
                })}

              {/* Tooltip crosshair */}
              {tooltip && (
                <>
                  <line
                    x1={tooltip.x}
                    y1={PAD_Y}
                    x2={tooltip.x}
                    y2={SVG_H - PAD_Y}
                    stroke="#3A3A3A"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={tooltip.x}
                    cy={tooltip.y}
                    r="4"
                    fill={metricConfig.color}
                    stroke="#111111"
                    strokeWidth="2"
                  />
                </>
              )}
            </>
          )}
        </svg>

        {/* Tooltip box */}
        {tooltip && !isEmpty && (
          <div
            className="absolute pointer-events-none z-10 bg-sf-bg-tertiary border border-sf-border rounded-sf px-2 py-1.5 text-xs shadow-md"
            style={{
              left: `${(tooltip.x / SVG_W) * 100}%`,
              top: `${(tooltip.y / (SVG_H + 24)) * 100}%`,
              transform: tooltip.x > SVG_W * 0.6
                ? "translate(-110%, -50%)"
                : "translate(10%, -50%)",
            }}
          >
            <p className="text-sf-text-secondary mb-0.5">
              {new Date(tooltip.dataPoint.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="font-bold font-display text-sf-text-primary">
              {tooltip.dataPoint[tooltip.metric].toFixed(1)}
            </p>
            <p className="text-sf-text-muted capitalize">
              {metricConfig.label}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
