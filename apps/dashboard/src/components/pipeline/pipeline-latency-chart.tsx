"use client";

import { cn, formatMs } from "@/lib/utils";

interface StageLatencies {
  scanning: number;
  extracting: number;
  generating: number;
}

interface PipelineLatencyChartProps {
  stageLatencies: StageLatencies;
  className?: string;
}

type StageKey = keyof StageLatencies;

const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: "scanning", label: "Scanning", color: "#4488FF" },
  { key: "extracting", label: "Extracting", color: "#CC88FF" },
  { key: "generating", label: "Generating", color: "#00FF88" },
];

const SVG_W = 600;
const SVG_H = 160;
const PAD_X = 90;
const PAD_RIGHT = 60;
const PAD_Y = 16;
const BAR_HEIGHT = 28;
const BAR_GAP = 12;

export function PipelineLatencyChart({
  stageLatencies,
  className,
}: PipelineLatencyChartProps) {
  const values = STAGES.map((s) => stageLatencies[s.key]);
  const totalLatency = values.reduce((sum, v) => sum + v, 0);
  const maxVal = Math.max(...values, 1);

  const usableW = SVG_W - PAD_X - PAD_RIGHT;
  const totalBarsHeight = STAGES.length * BAR_HEIGHT + (STAGES.length - 1) * BAR_GAP;
  const startY = PAD_Y + (SVG_H - PAD_Y * 2 - totalBarsHeight) / 2;

  const isEmpty = totalLatency === 0;

  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sf-text-primary font-display text-sm">
          Pipeline Latency by Stage
        </h3>
        <div className="flex items-center gap-3">
          {STAGES.map((s) => (
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

      <div className="relative w-full" style={{ aspectRatio: `${SVG_W}/${SVG_H}` }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-full"
        >
          <defs>
            {STAGES.map((s) => (
              <linearGradient
                key={s.key}
                id={`latency-grad-${s.key}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.6" />
              </linearGradient>
            ))}
          </defs>

          {isEmpty ? (
            <text
              x={SVG_W / 2}
              y={SVG_H / 2}
              textAnchor="middle"
              fontSize="12"
              fill="#555555"
            >
              No latency data available
            </text>
          ) : (
            <>
              {/* Bars */}
              {STAGES.map((stage, i) => {
                const val = stageLatencies[stage.key];
                const barW = Math.max((val / maxVal) * usableW, 2);
                const y = startY + i * (BAR_HEIGHT + BAR_GAP);

                return (
                  <g key={stage.key}>
                    {/* Stage label */}
                    <text
                      x={PAD_X - 8}
                      y={y + BAR_HEIGHT / 2 + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#999999"
                      fontWeight="500"
                    >
                      {stage.label}
                    </text>

                    {/* Background track */}
                    <rect
                      x={PAD_X}
                      y={y}
                      width={usableW}
                      height={BAR_HEIGHT}
                      rx="4"
                      fill="#1A1A1A"
                    />

                    {/* Value bar */}
                    <rect
                      x={PAD_X}
                      y={y}
                      width={barW}
                      height={BAR_HEIGHT}
                      rx="4"
                      fill={`url(#latency-grad-${stage.key})`}
                    />

                    {/* Value label */}
                    <text
                      x={PAD_X + barW + 8}
                      y={y + BAR_HEIGHT / 2 + 4}
                      textAnchor="start"
                      fontSize="11"
                      fill={stage.color}
                      fontWeight="600"
                    >
                      {formatMs(val)}
                    </text>
                  </g>
                );
              })}

              {/* Total latency reference line */}
              {(() => {
                const totalBarW = Math.min(
                  (totalLatency / maxVal) * usableW,
                  usableW
                );
                const lineX = PAD_X + totalBarW;
                const topY = startY - 6;
                const bottomY =
                  startY +
                  STAGES.length * BAR_HEIGHT +
                  (STAGES.length - 1) * BAR_GAP +
                  6;

                return totalBarW <= usableW ? (
                  <g>
                    <line
                      x1={lineX}
                      y1={topY}
                      x2={lineX}
                      y2={bottomY}
                      stroke="#FF6B6B"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={lineX}
                      y={topY - 4}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#FF6B6B"
                      fontWeight="500"
                    >
                      Total: {formatMs(totalLatency)}
                    </text>
                  </g>
                ) : null;
              })()}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
