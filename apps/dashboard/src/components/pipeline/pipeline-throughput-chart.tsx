"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DailyThroughput {
  date: string;
  total: number;
  succeeded: number;
  failed: number;
}

interface PipelineThroughputChartProps {
  dailyThroughput: DailyThroughput[];
  className?: string;
}

type SeriesKey = "succeeded" | "failed";

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "succeeded", label: "Succeeded", color: "#00FF88" },
  { key: "failed", label: "Failed", color: "#FF6B6B" },
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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface TooltipData {
  x: number;
  y: number;
  dataPoint: DailyThroughput;
}

const SVG_W = 600;
const SVG_H = 200;
const PAD_X = 40;
const PAD_Y = 16;

export function PipelineThroughputChart({
  dailyThroughput,
  className,
}: PipelineThroughputChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const succeededValues = dailyThroughput.map((d) => d.succeeded);
  const failedValues = dailyThroughput.map((d) => d.failed);
  const maxVal = Math.max(...succeededValues, ...failedValues, 0);

  const succeededLinePath = buildPath(succeededValues, maxVal, SVG_W, SVG_H, PAD_X, PAD_Y);
  const succeededAreaPath = buildAreaPath(succeededValues, maxVal, SVG_W, SVG_H, PAD_X, PAD_Y);
  const failedLinePath = buildPath(failedValues, maxVal, SVG_W, SVG_H, PAD_X, PAD_Y);
  const failedAreaPath = buildAreaPath(failedValues, maxVal, SVG_W, SVG_H, PAD_X, PAD_Y);

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    value: Math.round(frac * maxVal),
    y: PAD_Y + (SVG_H - PAD_Y * 2) * (1 - frac),
  }));

  // X-axis label interval
  const count = dailyThroughput.length;
  const xLabelInterval = count <= 7 ? 1 : count <= 30 ? 5 : 15;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || dailyThroughput.length < 2) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * SVG_W;
      const usableW = SVG_W - PAD_X * 2;
      const idx = Math.round(
        ((mouseX - PAD_X) / usableW) * (dailyThroughput.length - 1)
      );
      const clampedIdx = Math.max(0, Math.min(dailyThroughput.length - 1, idx));
      const dataPoint = dailyThroughput[clampedIdx];
      const x = PAD_X + (clampedIdx / (dailyThroughput.length - 1)) * usableW;
      const safeMax = maxVal === 0 ? 1 : maxVal;
      const y = PAD_Y + (SVG_H - PAD_Y * 2) * (1 - dataPoint.total / safeMax);
      setTooltip({ x, y, dataPoint });
    },
    [dailyThroughput, maxVal]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const isEmpty = maxVal === 0;

  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sf-text-primary font-display text-sm">
          Pipeline Throughput
        </h3>
        <div className="flex items-center gap-3">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-sf-text-secondary">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </div>
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
            <linearGradient id="throughput-grad-succeeded" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00FF88" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="throughput-grad-failed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0" />
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
                {tick.value >= 1000
                  ? `${(tick.value / 1000).toFixed(tick.value % 1000 === 0 ? 0 : 1)}k`
                  : tick.value}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {dailyThroughput.map((d, i) => {
            if (i % xLabelInterval !== 0 && i !== dailyThroughput.length - 1) return null;
            const x =
              PAD_X + (i / (dailyThroughput.length - 1)) * (SVG_W - PAD_X * 2);
            return (
              <text
                key={i}
                x={x}
                y={SVG_H + 16}
                textAnchor="middle"
                fontSize="9"
                fill="#555555"
              >
                {formatDateLabel(d.date)}
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
              {/* Succeeded area fill */}
              <path
                d={succeededAreaPath}
                fill="url(#throughput-grad-succeeded)"
              />

              {/* Succeeded line */}
              <path
                d={succeededLinePath}
                fill="none"
                stroke="#00FF88"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Failed area fill */}
              <path
                d={failedAreaPath}
                fill="url(#throughput-grad-failed)"
              />

              {/* Failed line */}
              <path
                d={failedLinePath}
                fill="none"
                stroke="#FF6B6B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points - only show for sparse data */}
              {dailyThroughput.length <= 14 &&
                dailyThroughput.map((d, i) => {
                  const safeMax = maxVal === 0 ? 1 : maxVal;
                  const x =
                    PAD_X +
                    (i / (dailyThroughput.length - 1)) * (SVG_W - PAD_X * 2);
                  const ySucceeded =
                    PAD_Y +
                    (SVG_H - PAD_Y * 2) * (1 - d.succeeded / safeMax);
                  const yFailed =
                    PAD_Y +
                    (SVG_H - PAD_Y * 2) * (1 - d.failed / safeMax);
                  return (
                    <g key={i}>
                      <circle
                        cx={x}
                        cy={ySucceeded}
                        r="3"
                        fill="#00FF88"
                        stroke="#111111"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={x}
                        cy={yFailed}
                        r="3"
                        fill="#FF6B6B"
                        stroke="#111111"
                        strokeWidth="1.5"
                      />
                    </g>
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
              {formatDateLabel(tooltip.dataPoint.date)}
            </p>
            <p className="font-bold font-display text-sf-text-primary">
              {tooltip.dataPoint.total.toLocaleString()} runs
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[#00FF88]">
                {tooltip.dataPoint.succeeded} passed
              </span>
              <span className="text-[#FF6B6B]">
                {tooltip.dataPoint.failed} failed
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
