"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Wrench, Files, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttributionData } from "@/lib/attribution";

// When received over JSON the Date field arrives as a string
type AttributionResponse = Omit<AttributionData, "sessionDate"> & {
  sessionDate: string;
};

interface SourceCardProps {
  postId: string;
}

function formatSessionDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-3 rounded bg-sf-bg-tertiary animate-pulse",
        className
      )}
    />
  );
}

export function SourceCard({ postId }: SourceCardProps) {
  const [data, setData] = useState<AttributionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/content/${postId}/attribution`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<AttributionResponse>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
        <SkeletonLine className="w-32" />
        <div className="space-y-2">
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-3/4" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
      <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
        Source Session
      </h3>

      <div className="space-y-2">
        {/* Date + duration */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm text-sf-text-secondary">
            <Calendar size={13} className="text-sf-text-muted flex-shrink-0" />
            {formatSessionDate(data.sessionDate)}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-sf-text-secondary">
            <Clock size={13} className="text-sf-text-muted flex-shrink-0" />
            {data.durationMinutes} min session
          </span>
        </div>

        {/* Files modified */}
        <span className="flex items-center gap-1.5 text-sm text-sf-text-secondary">
          <Files size={13} className="text-sf-text-muted flex-shrink-0" />
          {data.filesModifiedCount} file
          {data.filesModifiedCount !== 1 ? "s" : ""} modified
        </span>

        {/* Insight score */}
        <span className="flex items-center gap-1.5 text-sm text-sf-text-secondary">
          <Star size={13} className="text-sf-text-muted flex-shrink-0" />
          Insight Score:{" "}
          <span className="text-sf-accent font-semibold">
            {data.insightScore.toFixed(1)}/10
          </span>
        </span>

        {/* Tools used */}
        {data.toolsUsed.length > 0 && (
          <div className="flex items-start gap-1.5 flex-wrap">
            <Wrench
              size={13}
              className="text-sf-text-muted flex-shrink-0 mt-0.5"
            />
            <div className="flex flex-wrap gap-1">
              {data.toolsUsed.map((tool) => (
                <span
                  key={tool}
                  className="font-code text-xs px-1.5 py-0.5 rounded bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
