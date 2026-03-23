"use client";

import { useState, useRef, useCallback } from "react";
import { Eye, Heart, Share2, MessageCircle, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricKey = "impressions" | "likes" | "shares" | "comments" | "clicks";

interface PostDataPoint {
  id: string;
  platform: string;
  impressions: number | null;
  likes: number | null;
  shares: number | null;
  comments: number | null;
  clicks: number | null;
  syncedAt: string;
}

interface TrendChartProps {
  posts: PostDataPoint[];
  timeframe: "7d" | "30d" | "90d";
  className?: string;
}

const METRICS: { key: MetricKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "impressions", label: "Impressions", icon: <Eye size={12} />, color: "#00FF88" },
  { key: "likes", label: "Likes", icon: <Heart size={12} />, color: "#FF6B6B" },
  { key: "shares", label: "Shares", icon: <Share2 size={12} />, color: "#4488FF" },
  { key: "comments", label: "Comments", icon: <MessageCircle size={12} />, color: "#FFAA00" },
  { key: "clicks", label: "Clicks", icon: <MousePointerClick size={12} />, color: "#CC88FF" },
];

const TIMEFRAME_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

interface DayBucket {
  date: Date;
  label: string;
  impressions: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
}

function buildBuckets(posts: PostDataPoint[], timeframe: string): DayBucket[] {
  const days = TIMEFRAME_DAYS[timeframe] ?? 30;
  const now = new Date();
  const buckets: DayBucket[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    buckets.push({
      date: d,
      label,
      impressions: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      clicks: 0,
    });
  }

  for (const post of posts) {
    const synced = new Date(post.syncedAt);
    synced.setHours(0, 0, 0, 0);
    const bucket = buckets.find(
      (b) => b.date.getTime() === synced.getTime()
    );
    if (bucket) {
      bucket.impressions += post.impressions ?? 0;
      bucket.likes += post.likes ?? 0;
      bucket.shares += post.shares ?? 0;
      bucket.comments += post.comments ?? 0;
      bucket.clicks += post.clicks ?? 0;
    }
  }

  return buckets;
}

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
  bucket: DayBucket;
  metric: MetricKey;
}

const SVG_W = 600;
const SVG_H = 200;
const PAD_X = 40;
const PAD_Y = 16;

export function TrendChart({ posts, timeframe, className }: TrendChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("impressions");
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const buckets = buildBuckets(posts, timeframe);
  const values = buckets.map((b) => b[activeMetric]);
  const maxVal = Math.max(...values, 0);

  const metricConfig = METRICS.find((m) => m.key === activeMetric)!;
  const linePath = buildPath(values, maxVal, SVG_W, SVG_H, PAD_X, PAD_Y);
  const areaPath = buildAreaPath(values, maxVal, SVG_W, SVG_H, PAD_X, PAD_Y);

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    value: Math.round(frac * maxVal),
    y: PAD_Y + (SVG_H - PAD_Y * 2) * (1 - frac),
  }));

  // X-axis label interval
  const days = TIMEFRAME_DAYS[timeframe] ?? 30;
  const xLabelInterval = days <= 7 ? 1 : days <= 30 ? 5 : 15;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * SVG_W;
      const usableW = SVG_W - PAD_X * 2;
      const idx = Math.round(
        ((mouseX - PAD_X) / usableW) * (buckets.length - 1)
      );
      const clampedIdx = Math.max(0, Math.min(buckets.length - 1, idx));
      const bucket = buckets[clampedIdx];
      const val = bucket[activeMetric];
      const safeMax = maxVal === 0 ? 1 : maxVal;
      const x = PAD_X + (clampedIdx / (buckets.length - 1)) * usableW;
      const y = PAD_Y + (SVG_H - PAD_Y * 2) * (1 - val / safeMax);
      setTooltip({ x, y, bucket, metric: activeMetric });
    },
    [buckets, activeMetric, maxVal]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Shared logic to compute tooltip from a client x-coordinate
  const computeTooltipFromClientX = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const touchX = ((clientX - rect.left) / rect.width) * SVG_W;
      const usableW = SVG_W - PAD_X * 2;
      const idx = Math.round(
        ((touchX - PAD_X) / usableW) * (buckets.length - 1)
      );
      const clampedIdx = Math.max(0, Math.min(buckets.length - 1, idx));
      const bucket = buckets[clampedIdx];
      const val = bucket[activeMetric];
      const safeMax = maxVal === 0 ? 1 : maxVal;
      const x = PAD_X + (clampedIdx / (buckets.length - 1)) * usableW;
      const y = PAD_Y + (SVG_H - PAD_Y * 2) * (1 - val / safeMax);
      setTooltip({ x, y, bucket, metric: activeMetric });
    },
    [buckets, activeMetric, maxVal]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        computeTooltipFromClientX(e.touches[0].clientX);
      }
    },
    [computeTooltipFromClientX]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        computeTooltipFromClientX(e.touches[0].clientX);
      }
    },
    [computeTooltipFromClientX]
  );

  const handleTouchEnd = useCallback(() => setTooltip(null), []);

  // Pinch-to-zoom state
  const [chartScale, setChartScale] = useState(1);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);

  const handleChartTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.hypot(dx, dy);
        pinchStartScale.current = chartScale;
      }
    },
    [chartScale]
  );

  const handleChartTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2 && pinchStartDist.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = pinchStartScale.current * (dist / pinchStartDist.current);
        setChartScale(Math.min(Math.max(scale, 1), 3));
      }
    },
    []
  );

  const handleChartTouchEnd = useCallback(() => {
    pinchStartDist.current = null;
  }, []);

  const isEmpty = maxVal === 0;

  return (
    <div
      className={cn(
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h3 className="font-semibold text-sf-text-primary font-display text-sm">
          Engagement Trend
        </h3>
        <div className="flex items-center gap-1 flex-wrap justify-start sm:justify-end">
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

      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: `${SVG_W}/${SVG_H + 24}`,
          touchAction: chartScale > 1 ? "none" : "pan-y",
        }}
        onTouchStart={handleChartTouchStart}
        onTouchMove={handleChartTouchMove}
        onTouchEnd={handleChartTouchEnd}
      >
        <div
          style={{
            transform: `scale(${chartScale})`,
            transformOrigin: "center center",
            transition: pinchStartDist.current !== null ? "none" : "transform 0.2s ease-out",
          }}
        >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H + 24}`}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
                {tick.value >= 1000
                  ? `${(tick.value / 1000).toFixed(tick.value % 1000 === 0 ? 0 : 1)}k`
                  : tick.value}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {buckets.map((b, i) => {
            if (i % xLabelInterval !== 0 && i !== buckets.length - 1) return null;
            const x =
              PAD_X + (i / (buckets.length - 1)) * (SVG_W - PAD_X * 2);
            return (
              <text
                key={i}
                x={x}
                y={SVG_H + 16}
                textAnchor="middle"
                fontSize="9"
                fill="#555555"
              >
                {b.label}
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
              {buckets.length <= 14 &&
                buckets.map((b, i) => {
                  const val = b[activeMetric];
                  const safeMax = maxVal === 0 ? 1 : maxVal;
                  const x =
                    PAD_X +
                    (i / (buckets.length - 1)) * (SVG_W - PAD_X * 2);
                  const y =
                    PAD_Y +
                    (SVG_H - PAD_Y * 2) * (1 - val / safeMax);
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
        </div>

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
            <p className="text-sf-text-secondary mb-0.5">{tooltip.bucket.label}</p>
            <p className="font-bold font-display text-sf-text-primary">
              {tooltip.bucket[tooltip.metric].toLocaleString()}
            </p>
            <p className="text-sf-text-muted capitalize">{tooltip.metric}</p>
          </div>
        )}
      </div>
    </div>
  );
}
