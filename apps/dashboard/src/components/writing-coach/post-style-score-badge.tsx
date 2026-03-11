"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { PostStyleAnalysis } from "@/lib/writing-coach";

export interface PostStyleScoreBadgeProps {
  grade: string;
  score: number;
  size?: "sm" | "md";
  className?: string;
}

interface TooltipState {
  show: boolean;
  x: number;
  y: number;
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  B: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  C: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  D: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  F: "bg-red-500/10 text-red-500 border-red-500/20",
};

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
};

export function PostStyleScoreBadge({
  grade,
  score,
  size = "md",
  className,
}: PostStyleScoreBadgeProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    show: false,
    x: 0,
    y: 0,
  });

  const gradeColor = GRADE_COLORS[grade] || GRADE_COLORS.F;
  const sizeClass = SIZE_CLASSES[size];

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, x: 0, y: 0 });
  };

  return (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium font-display rounded-sf border",
          gradeColor,
          sizeClass,
          "cursor-help transition-colors",
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="font-bold">{grade}</span>
        <span className="opacity-70">{score.toFixed(0)}</span>
      </span>

      {tooltip.show && (
        <div
          className="fixed z-50 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-xs shadow-md pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 8}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-sf-text-secondary mb-1">Authenticity Score</p>
          <p className="font-bold font-display text-sf-text-primary text-sm">
            {score.toFixed(1)} / 100
          </p>
          <div className="mt-1.5 pt-1.5 border-t border-sf-border">
            <p className="text-sf-text-muted">
              {getScoreDescription(score)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function getScoreDescription(score: number): string {
  if (score >= 90) return "Excellent authenticity";
  if (score >= 80) return "Good authenticity";
  if (score >= 70) return "Fair authenticity";
  if (score >= 60) return "Below average";
  return "Needs improvement";
}

/**
 * Hook to fetch post style score from the API.
 */
export function usePostStyleScore(postId: string) {
  return useQuery({
    queryKey: ["post-style-score", postId],
    queryFn: async () => {
      const res = await fetch(`/api/writing-coach/post/${postId}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || "Failed to fetch post style score");
      }
      return res.json() as Promise<PostStyleAnalysis>;
    },
    enabled: !!postId,
  });
}
