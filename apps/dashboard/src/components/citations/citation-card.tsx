"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

/** Citation metadata stored in the database. */
export interface CitationMetadata {
  sessionId: string;
  messageIndex: number;
  text: string;
  type: "tool_call" | "file_edit" | "conversation" | "evidence";
}

/** Extended citation with session context. */
export interface CitationCardData extends CitationMetadata {
  /** Optional session title/name for display. */
  sessionTitle?: string;
  /** Optional timestamp for the citation. */
  timestamp?: string;
  /** Optional project name associated with the session. */
  projectName?: string;
  /** Additional context text (e.g., surrounding code or conversation). */
  contextPreview?: string;
}

/** Props for the CitationCard component. */
export interface CitationCardProps {
  /** Citation data to display. */
  citation: CitationCardData;
  /** Base URL for session transcript viewer (default: "/sessions"). */
  baseUrl?: string;
  /** Whether the card is initially expanded (default: false). */
  defaultExpanded?: boolean;
  /** Callback when citation is clicked. */
  onClick?: (citation: CitationCardData) => void;
}

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "/sessions";

/** Human-readable labels and styling for citation types. */
interface TypeConfig {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

const TYPE_CONFIG: Record<CitationMetadata["type"], TypeConfig> = {
  tool_call: {
    label: "Tool Call",
    icon: "⚙",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/15",
  },
  file_edit: {
    label: "File Edit",
    icon: "✎",
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
  },
  conversation: {
    label: "Conversation",
    icon: "💬",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
  },
  evidence: {
    label: "Evidence",
    icon: "★",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
  },
};

// ── Main Component ─────────────────────────────────────────────────────────

/**
 * Citation Card Component
 *
 * Renders an expandable card showing citation details with session context.
 * Cards can be expanded to show additional context and metadata.
 * Clicking the card opens the session transcript at the specific message.
 *
 * Design follows the evidence-explorer pattern with expandable cards:
 * - Compact header with type badge and session info
 * - Citation text preview (collapsible)
 * - Expandable section showing full context
 * - Clickable to open transcript
 *
 * @example
 * ```tsx
 * <CitationCard
 *   citation={{
 *     sessionId: "abc-123",
 *     messageIndex: 10,
 *     text: "Refactored authentication module",
 *     type: "file_edit",
 *     sessionTitle: "Auth System Refactor",
 *     contextPreview: "// Updated auth/index.ts\nexport const authenticate = ..."
 *   }}
 *   baseUrl="/workspace/sessions"
 * />
 * ```
 */
export function CitationCard({
  citation,
  baseUrl = DEFAULT_BASE_URL,
  defaultExpanded = false,
  onClick,
}: CitationCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const config = TYPE_CONFIG[citation.type];

  // Build transcript URL
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const transcriptUrl = `${cleanBaseUrl}/${citation.sessionId}#msg-${citation.messageIndex}`;

  const handleCardClick = () => {
    if (onClick) {
      onClick(citation);
    } else {
      // Default behavior: open transcript in new tab
      window.open(transcriptUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Shortened session ID for display
  const shortSessionId = citation.sessionId.slice(0, 8);

  return (
    <div className="w-full rounded-sf border border-sf-border bg-sf-bg-tertiary hover:border-sf-border-focus transition-colors">
      {/* Card header - always visible */}
      <div className="p-3">
        {/* Type badge and timestamp */}
        <div className="flex items-center justify-between mb-1.5">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </span>
          {citation.timestamp && (
            <span className="text-[10px] text-sf-text-muted">
              {citation.timestamp}
            </span>
          )}
        </div>

        {/* Session title and project */}
        {citation.sessionTitle && (
          <p className="text-xs font-medium text-sf-text-primary truncate">
            {citation.sessionTitle}
          </p>
        )}
        {citation.projectName && (
          <p className="text-[10px] text-sf-text-secondary mt-0.5">
            {citation.projectName}
          </p>
        )}

        {/* Citation text preview */}
        <p
          className={`text-xs text-sf-text-secondary mt-1.5 leading-relaxed ${
            isExpanded ? "" : "line-clamp-2"
          }`}
        >
          {citation.text}
        </p>

        {/* Footer: session reference and expand toggle */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            onClick={handleCardClick}
            className="flex items-center gap-1.5 text-[10px] text-sf-text-muted hover:text-sf-accent transition-colors group"
          >
            <span>Session {shortSessionId}</span>
            <span>·</span>
            <span>Message #{citation.messageIndex}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </span>
          </button>

          {citation.contextPreview && (
            <button
              onClick={handleExpandToggle}
              className="text-[10px] text-sf-accent hover:text-sf-accent/80 transition-colors flex items-center gap-1"
            >
              <span>{isExpanded ? "Hide" : "Show"} context</span>
              <span
                className={`transform transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable context section */}
      {isExpanded && citation.contextPreview && (
        <div className="border-t border-sf-border bg-sf-bg-secondary">
          <div className="p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-sf-text-primary uppercase tracking-wide">
                Session Context
              </span>
            </div>
            <pre className="text-xs text-sf-text-secondary leading-relaxed whitespace-pre-wrap font-mono bg-sf-bg-tertiary rounded px-2 py-1.5 border border-sf-border overflow-x-auto">
              {citation.contextPreview}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

export function EmptyCitationsState() {
  return (
    <div className="flex items-center justify-center p-6 text-center">
      <div>
        <div className="text-2xl mb-2 opacity-40">📝</div>
        <p className="text-sm text-sf-text-muted">No citations available.</p>
        <p className="text-xs text-sf-text-muted mt-1">
          Citations will appear when evidence is linked to your content.
        </p>
      </div>
    </div>
  );
}

// ── Citation List ──────────────────────────────────────────────────────────

/** Props for the CitationCardList component. */
export interface CitationCardListProps {
  /** Array of citations to render as cards. */
  citations: CitationCardData[];
  /** Base URL for session transcript viewer (default: "/sessions"). */
  baseUrl?: string;
  /** Callback when a citation is clicked. */
  onCitationClick?: (citation: CitationCardData) => void;
}

/**
 * Citation Card List Component
 *
 * Renders a list of citation cards with optional filtering and sorting.
 * Useful for displaying all citations in a post or document.
 *
 * @example
 * ```tsx
 * <CitationCardList
 *   citations={postCitations}
 *   baseUrl="/workspace/sessions"
 * />
 * ```
 */
export function CitationCardList({
  citations,
  baseUrl = DEFAULT_BASE_URL,
  onCitationClick,
}: CitationCardListProps) {
  if (citations.length === 0) {
    return <EmptyCitationsState />;
  }

  return (
    <div className="space-y-2">
      {citations.map((citation, index) => (
        <CitationCard
          key={`${citation.sessionId}-${citation.messageIndex}-${index}`}
          citation={citation}
          baseUrl={baseUrl}
          onClick={onCitationClick}
        />
      ))}
    </div>
  );
}
