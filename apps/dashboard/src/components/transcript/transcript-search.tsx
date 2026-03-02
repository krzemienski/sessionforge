"use client";

import React, { useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TranscriptSearchProps {
  /** Current search query string. */
  query: string;
  /** Called when the user changes the search input. */
  onChange: (query: string) => void;
  /** Total number of matches found across the transcript. */
  matchCount: number;
  /** Zero-based index of the currently active match. */
  currentMatch: number;
  /** Navigate to the next match. */
  onNext: () => void;
  /** Navigate to the previous match. */
  onPrev: () => void;
  /** Dismiss / close the search bar. */
  onClose: () => void;
  className?: string;
}

// ── TranscriptSearch ──────────────────────────────────────────────────────────

export function TranscriptSearch({
  query,
  onChange,
  matchCount,
  currentMatch,
  onNext,
  onPrev,
  onClose,
  className,
}: TranscriptSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the search bar mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcuts: Enter → next, Shift+Enter → prev, Escape → close
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
  };

  const hasMatches = matchCount > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        "bg-sf-bg-secondary border border-sf-border rounded-sf-lg",
        "shadow-sf-md",
        className
      )}
      role="search"
      aria-label="Transcript search"
    >
      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search transcript…"
        aria-label="Search query"
        aria-controls="transcript-search-status"
        className={cn(
          "flex-1 min-w-0 bg-transparent text-sm text-sf-text-primary",
          "placeholder:text-sf-text-muted focus:outline-none"
        )}
      />

      {/* Match counter */}
      <span
        id="transcript-search-status"
        aria-live="polite"
        aria-atomic
        className={cn(
          "shrink-0 text-xs font-code tabular-nums whitespace-nowrap",
          hasQuery && !hasMatches
            ? "text-sf-danger"
            : "text-sf-text-muted"
        )}
      >
        {hasQuery
          ? hasMatches
            ? `${currentMatch + 1} of ${matchCount}`
            : "No matches"
          : null}
      </span>

      {/* Separator */}
      {hasQuery && (
        <div className="shrink-0 h-4 w-px bg-sf-border" aria-hidden />
      )}

      {/* Prev button */}
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasMatches}
        aria-label="Previous match (Shift+Enter)"
        title="Previous match (Shift+Enter)"
        className={cn(
          "shrink-0 p-1 rounded-sf transition-colors",
          hasMatches
            ? "text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover"
            : "text-sf-text-muted cursor-not-allowed opacity-40"
        )}
      >
        <ChevronUp size={15} />
      </button>

      {/* Next button */}
      <button
        type="button"
        onClick={onNext}
        disabled={!hasMatches}
        aria-label="Next match (Enter)"
        title="Next match (Enter)"
        className={cn(
          "shrink-0 p-1 rounded-sf transition-colors",
          hasMatches
            ? "text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover"
            : "text-sf-text-muted cursor-not-allowed opacity-40"
        )}
      >
        <ChevronDown size={15} />
      </button>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search (Escape)"
        title="Close search (Escape)"
        className="shrink-0 p-1 rounded-sf text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-bg-hover transition-colors"
      >
        <X size={15} />
      </button>
    </div>
  );
}
