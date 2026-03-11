"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

// --- Types ---

type ConsistencyLevel =
  | "very-consistent"
  | "mostly-consistent"
  | "somewhat-inconsistent"
  | "inconsistent";

interface VoiceConsistencyData {
  score: number | null;
  consistencyLevel: ConsistencyLevel | null;
  deviations: string[];
  hasStyleProfile: boolean;
}

interface VoiceConsistencyCardProps {
  data: VoiceConsistencyData;
  workspace: string;
}

// --- Helpers ---

function getConsistencyColor(level: ConsistencyLevel | null): string {
  if (!level) return "#94a3b8"; // sf-text-secondary
  switch (level) {
    case "very-consistent":
      return "#10b981"; // emerald-500
    case "mostly-consistent":
      return "#3b82f6"; // blue-500
    case "somewhat-inconsistent":
      return "#f59e0b"; // amber-500
    case "inconsistent":
      return "#ef4444"; // red-500
  }
}

function getConsistencyLabel(level: ConsistencyLevel | null): string {
  if (!level) return "No Data";
  return level
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Generates an SVG arc path for a circular gauge.
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param radius - Radius of the arc
 * @param startAngle - Starting angle in degrees (0 = top, clockwise)
 * @param endAngle - Ending angle in degrees
 * @returns SVG path string
 */
function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

// --- Sub-components ---

function CircularGauge({ score, level }: { score: number; level: ConsistencyLevel | null }) {
  const size = 140;
  const strokeWidth = 12;
  const center = size / 2;
  const radius = center - strokeWidth / 2;

  // Arc goes from 0 (bottom left) to 270 degrees (3/4 circle clockwise)
  const startAngle = 135; // Start at bottom-left
  const maxAngle = 270; // Full range (3/4 circle)
  const scoreAngle = startAngle + (score / 100) * maxAngle;

  const backgroundPath = describeArc(center, center, radius, startAngle, startAngle + maxAngle);
  const scorePath = describeArc(center, center, radius, startAngle, scoreAngle);
  const color = getConsistencyColor(level);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform rotate-0">
        {/* Background arc */}
        <path
          d={backgroundPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={scorePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        {/* Center text */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          className="text-3xl font-bold fill-sf-text-primary tabular-nums"
        >
          {Math.round(score)}
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          className="text-sm fill-sf-text-secondary"
        >
          / 100
        </text>
      </svg>
      <p className="mt-3 text-sm font-medium" style={{ color }}>
        {getConsistencyLabel(level)}
      </p>
    </div>
  );
}

function DeviationsList({ deviations }: { deviations: string[] }) {
  if (deviations.length === 0) {
    return (
      <div className="text-sm text-sf-text-secondary italic">
        No significant deviations detected. Your voice is consistent with your established style.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {deviations.map((deviation, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-sf-text-primary">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>{deviation}</span>
        </li>
      ))}
    </ul>
  );
}

function NoProfilePrompt({ workspace }: { workspace: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-12 h-12 rounded-sf-full bg-sf-accent-bg border border-sf-accent/30 flex items-center justify-center mb-4">
        <AlertCircle size={24} className="text-sf-accent" />
      </div>
      <h3 className="text-base font-semibold text-sf-text-primary mb-2">
        No Writing Style Profile
      </h3>
      <p className="text-sm text-sf-text-secondary mb-4 max-w-md">
        Generate a writing style profile to track voice consistency across your posts. The profile
        analyzes your published content to establish your baseline style.
      </p>
      <Link
        href={`/${workspace}/settings/style`}
        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-sf-accent hover:bg-sf-accent-hover rounded-sf transition-colors border border-sf-accent"
      >
        Generate Style Profile
      </Link>
    </div>
  );
}

// --- Main component ---

export function VoiceConsistencyCard({ data, workspace }: VoiceConsistencyCardProps) {
  const { score, consistencyLevel, deviations, hasStyleProfile } = data;

  if (!hasStyleProfile) {
    return (
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <h2 className="text-base font-semibold text-sf-text-primary mb-4">Voice Consistency</h2>
        <NoProfilePrompt workspace={workspace} />
      </div>
    );
  }

  if (score === null || consistencyLevel === null) {
    return (
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <h2 className="text-base font-semibold text-sf-text-primary mb-4">Voice Consistency</h2>
        <div className="flex items-center justify-center py-8 text-sm text-sf-text-secondary">
          No consistency data available yet. Analyze your posts to generate voice consistency
          scores.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-sf-text-primary">Voice Consistency</h2>
        <p className="text-sm text-sf-text-secondary mt-1">
          How well your writing matches your established style profile
        </p>
      </div>

      {/* Gauge */}
      <div className="flex items-center justify-center py-4">
        <CircularGauge score={score} level={consistencyLevel} />
      </div>

      {/* Deviations */}
      {deviations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-sf-text-primary mb-3">Style Deviations</h3>
          <DeviationsList deviations={deviations} />
        </div>
      )}

      {deviations.length === 0 && (
        <div className="text-sm text-sf-text-secondary text-center italic py-2">
          No significant deviations detected. Your voice is consistent with your established style.
        </div>
      )}
    </div>
  );
}
