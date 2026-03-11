"use client";

import { useState } from "react";
import type { NodeKey } from "lexical";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CitationInlineMarkerProps {
  /** Session UUID or identifier. */
  sessionId: string;
  /** Zero-based message index within the session. */
  messageIndex: number;
  /** Lexical node key (for editor integration). */
  nodeKey: NodeKey;
  /** Base URL for session transcript viewer (default: "/sessions"). */
  baseUrl?: string;
  /** Callback when citation is clicked. */
  onClick?: (sessionId: string, messageIndex: number) => void;
}

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "/sessions";

// ── Citation Badge ─────────────────────────────────────────────────────────

/**
 * Inline citation marker component for Lexical editor.
 *
 * Renders citation markers as small, clickable badges that show a preview
 * tooltip on hover. Citations link to specific messages in session transcripts.
 *
 * Design follows the citation-footnote pattern with inline styling:
 * - Compact badge format for inline display
 * - Hover tooltip showing session reference
 * - Clickable to open transcript
 * - Visual indicator (icon) for citation type
 *
 * @example
 * ```tsx
 * <CitationInlineMarker
 *   sessionId="abc-123"
 *   messageIndex={10}
 *   nodeKey="node-key-123"
 *   baseUrl="/workspace/sessions"
 * />
 * ```
 */
export function CitationInlineMarker({
  sessionId,
  messageIndex,
  nodeKey,
  baseUrl = DEFAULT_BASE_URL,
  onClick,
}: CitationInlineMarkerProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Build transcript URL
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const transcriptUrl = `${cleanBaseUrl}/${sessionId}#msg-${messageIndex}`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onClick) {
      onClick(sessionId, messageIndex);
    } else {
      // Default behavior: open transcript in new tab
      window.open(transcriptUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleMouseEnter = () => setShowTooltip(true);
  const handleMouseLeave = () => setShowTooltip(false);

  // Shortened session ID for display
  const shortSessionId = sessionId.slice(0, 8);

  return (
    <span
      className="inline-block relative mx-0.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Citation badge */}
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 hover:border-cyan-500/50 transition-colors cursor-pointer"
        title={`Citation: Session ${shortSessionId}, Message #${messageIndex}`}
        data-citation-node-key={nodeKey}
      >
        <span className="opacity-70">★</span>
        <span>{messageIndex}</span>
      </button>

      {/* Hover tooltip */}
      {showTooltip && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 pointer-events-none">
          <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf shadow-lg px-3 py-2 min-w-[200px] max-w-[300px]">
            {/* Tooltip header */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-cyan-400 text-xs">★</span>
              <span className="text-xs font-semibold text-sf-text-primary">
                Evidence Citation
              </span>
            </div>

            {/* Session reference */}
            <div className="text-[10px] text-sf-text-secondary space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-sf-text-muted">Session:</span>
                <span className="font-mono">{shortSessionId}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sf-text-muted">Message:</span>
                <span className="font-mono">#{messageIndex}</span>
              </div>
            </div>

            {/* Click hint */}
            <div className="mt-2 pt-1.5 border-t border-sf-border text-[9px] text-sf-accent">
              Click to view in transcript →
            </div>
          </div>

          {/* Tooltip arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-sf-border" />
        </div>
      )}
    </span>
  );
}
