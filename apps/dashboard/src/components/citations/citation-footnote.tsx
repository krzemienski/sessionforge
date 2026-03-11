"use client";

// ── Types ──────────────────────────────────────────────────────────────────

/** Citation metadata stored in the database. */
export interface CitationMetadata {
  sessionId: string;
  messageIndex: number;
  text: string;
  type: "tool_call" | "file_edit" | "conversation" | "evidence";
}

/** Formatted citation with reference number. */
export interface FootnoteCitation extends CitationMetadata {
  /** Reference number for the footnote (1-indexed). */
  referenceNumber: number;
  /** URL to the session transcript location. */
  transcriptUrl: string;
}

/** Props for the CitationFootnote component. */
export interface CitationFootnoteProps {
  /** Array of citations to render as footnotes. */
  citations: CitationMetadata[];
  /** Base URL for session transcript viewer (default: "/sessions"). */
  baseUrl?: string;
  /** Callback when a citation is clicked. */
  onCitationClick?: (citation: FootnoteCitation) => void;
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

// ── Citation Item ──────────────────────────────────────────────────────────

interface CitationItemProps {
  citation: FootnoteCitation;
  onClick?: () => void;
}

function CitationItem({ citation, onClick }: CitationItemProps) {
  const config = TYPE_CONFIG[citation.type];

  return (
    <li className="mb-2 last:mb-0">
      <button
        onClick={onClick}
        className="w-full text-left rounded-sf border border-sf-border bg-sf-bg-tertiary hover:border-sf-border-focus hover:bg-sf-bg-secondary transition-colors p-2.5 group"
      >
        {/* Reference number and type badge */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-sf-text-primary">
            [{citation.referenceNumber}]
          </span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bgColor} ${config.color}`}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </span>
        </div>

        {/* Citation text */}
        <p className="text-xs text-sf-text-secondary leading-relaxed line-clamp-2">
          {citation.text}
        </p>

        {/* Session reference */}
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-sf-text-muted">
          <span>Session {citation.sessionId.slice(0, 8)}</span>
          <span>·</span>
          <span>Message #{citation.messageIndex}</span>
          <span className="ml-auto text-sf-accent opacity-0 group-hover:opacity-100 transition-opacity">
            View →
          </span>
        </div>
      </button>
    </li>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
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

// ── Main Component ─────────────────────────────────────────────────────────

/**
 * Citation Footnote Component
 *
 * Renders citations as numbered footnotes with links to session transcripts.
 * Each citation displays its type, text preview, and session reference.
 * Clicking a citation opens the session transcript at the specific message.
 *
 * @example
 * ```tsx
 * <CitationFootnote
 *   citations={[
 *     {
 *       sessionId: "abc-123",
 *       messageIndex: 10,
 *       text: "Refactored authentication module",
 *       type: "file_edit"
 *     }
 *   ]}
 *   baseUrl="/workspace/sessions"
 *   onCitationClick={(citation) => console.log("Clicked:", citation)}
 * />
 * ```
 */
export function CitationFootnote({
  citations,
  baseUrl = DEFAULT_BASE_URL,
  onCitationClick,
}: CitationFootnoteProps) {
  if (citations.length === 0) {
    return <EmptyState />;
  }

  // Build transcript URLs and add reference numbers
  const footnoteCitations: FootnoteCitation[] = citations.map(
    (citation, index) => {
      const cleanBaseUrl = baseUrl.endsWith("/")
        ? baseUrl.slice(0, -1)
        : baseUrl;
      const transcriptUrl = `${cleanBaseUrl}/${citation.sessionId}#msg-${citation.messageIndex}`;

      return {
        ...citation,
        referenceNumber: index + 1,
        transcriptUrl,
      };
    }
  );

  const handleCitationClick = (citation: FootnoteCitation) => {
    if (onCitationClick) {
      onCitationClick(citation);
    } else {
      // Default behavior: open transcript in new tab
      window.open(citation.transcriptUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-3 pb-2 border-b border-sf-border">
        <h3 className="text-sm font-semibold text-sf-text-primary">
          References
        </h3>
        <p className="text-xs text-sf-text-muted mt-0.5">
          {footnoteCitations.length}{" "}
          {footnoteCitations.length === 1 ? "citation" : "citations"} from
          session transcripts
        </p>
      </div>

      {/* Citation list */}
      <ol className="list-none p-0 m-0 space-y-0">
        {footnoteCitations.map((citation) => (
          <CitationItem
            key={`${citation.sessionId}-${citation.messageIndex}-${citation.referenceNumber}`}
            citation={citation}
            onClick={() => handleCitationClick(citation)}
          />
        ))}
      </ol>
    </div>
  );
}
