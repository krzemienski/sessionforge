"use client";

import React, { useCallback, useId } from "react";
import { Bookmark, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookmarkMarker {
  messageIndex: number;
  label?: string;
}

export interface TimelineScrubberProps {
  /** Total number of messages in the transcript. */
  totalMessages: number;
  /** Zero-based index of the currently visible message. */
  currentPosition: number;
  /** Called when the user drags the scrubber or clicks a bookmark pill. */
  onChange: (position: number) => void;
  /** Optional list of bookmark positions to render as dot markers. */
  bookmarks?: BookmarkMarker[];
  /**
   * When provided, a "Send to Insights" button is shown alongside bookmarks.
   * Clicking it triggers insight extraction for the session.
   */
  onSendToInsights?: () => void;
  /** Whether insight extraction is currently in-flight. */
  isSendingInsights?: boolean;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPercent(index: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (index / max) * 100));
}

// ── TimelineScrubber ──────────────────────────────────────────────────────────

export function TimelineScrubber({
  totalMessages,
  currentPosition,
  onChange,
  bookmarks = [],
  onSendToInsights,
  isSendingInsights = false,
  className,
}: TimelineScrubberProps) {
  const inputId = useId();
  // max step value for the range input (messages are 0-indexed)
  const max = Math.max(totalMessages - 1, 0);
  const progressPct = toPercent(currentPosition, max);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  const disabled = totalMessages === 0;

  return (
    <div className={cn("select-none", className)}>
      {/* ── Header: label + position counter ──────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={inputId}
          className="text-xs font-code text-sf-text-muted uppercase tracking-wider cursor-pointer"
        >
          Timeline
        </label>
        <span className="text-xs font-code tabular-nums" aria-live="polite" aria-atomic>
          <span className="text-sf-accent">{disabled ? 0 : currentPosition + 1}</span>
          <span className="text-sf-text-muted"> / {totalMessages}</span>
        </span>
      </div>

      {/* ── Track area ────────────────────────────────────────────────── */}
      <div className="relative h-7 flex items-center">
        {/* Track background */}
        <div
          className="absolute inset-x-0 h-1 rounded-sf-full bg-sf-bg-active"
          aria-hidden
        >
          {/* Progress fill */}
          <div
            className="h-full rounded-sf-full bg-sf-accent/40"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Bookmark dot markers (visual only — range input captures pointer events) */}
        {bookmarks.map((bm, i) => {
          const pct = toPercent(bm.messageIndex, max);
          const isActive = bm.messageIndex === currentPosition;
          return (
            <div
              key={i}
              aria-hidden
              className={cn(
                "absolute -translate-x-1/2 w-2 h-2 rounded-sf-full border pointer-events-none",
                isActive
                  ? "bg-sf-accent border-sf-accent"
                  : "bg-sf-bg-tertiary border-sf-accent/70"
              )}
              style={{ left: `${pct}%` }}
            />
          );
        })}

        {/* Thumb indicator (pointer-events-none so the range input handles dragging) */}
        <div
          aria-hidden
          className="absolute -translate-x-1/2 w-3 h-3 rounded-sf-full bg-sf-accent border-2 border-sf-bg-primary pointer-events-none shadow-[0_0_6px_var(--color-sf-accent)]"
          style={{ left: `${progressPct}%` }}
        />

        {/* Native range input — transparent overlay for interaction */}
        <input
          id={inputId}
          type="range"
          min={0}
          max={max}
          step={1}
          value={currentPosition}
          onChange={handleChange}
          disabled={disabled}
          aria-label={`Timeline scrubber: message ${disabled ? 0 : currentPosition + 1} of ${totalMessages}`}
          aria-valuemin={0}
          aria-valuemax={totalMessages}
          aria-valuenow={disabled ? 0 : currentPosition + 1}
          className={cn(
            "absolute inset-0 w-full opacity-0 z-10",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        />
      </div>

      {/* ── Bookmark pills ────────────────────────────────────────────── */}
      {bookmarks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {bookmarks.map((bm, i) => {
            const isActive = bm.messageIndex === currentPosition;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChange(bm.messageIndex)}
                title={bm.label ?? `Message ${bm.messageIndex + 1}`}
                className={cn(
                  "flex items-center gap-1 text-xs font-code px-2 py-0.5 rounded-sf border transition-colors",
                  isActive
                    ? "border-sf-accent/50 bg-sf-accent-bg text-sf-accent"
                    : "border-sf-border bg-sf-bg-secondary text-sf-text-muted hover:border-sf-border-focus hover:text-sf-text-primary"
                )}
              >
                <Bookmark size={10} className="shrink-0" />
                <span className="truncate max-w-32">
                  {bm.label ?? `#${bm.messageIndex + 1}`}
                </span>
              </button>
            );
          })}

          {/* "Send to Insights" — triggers insight extraction for bookmarked session */}
          {onSendToInsights && (
            <button
              type="button"
              onClick={onSendToInsights}
              disabled={isSendingInsights}
              title="Extract insights from this session's bookmarked moments"
              className={cn(
                "flex items-center gap-1 text-xs font-code px-2 py-0.5 rounded-sf border transition-colors ml-auto",
                isSendingInsights
                  ? "border-sf-accent/30 bg-sf-accent-bg text-sf-accent/60 cursor-not-allowed"
                  : "border-sf-accent/50 bg-sf-accent-bg text-sf-accent hover:bg-sf-accent/20"
              )}
            >
              {isSendingInsights ? (
                <Loader2 size={10} className="shrink-0 animate-spin" />
              ) : (
                <Lightbulb size={10} className="shrink-0" />
              )}
              <span>{isSendingInsights ? "Extracting…" : "Send to Insights"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
