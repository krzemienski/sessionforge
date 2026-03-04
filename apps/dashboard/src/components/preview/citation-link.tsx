"use client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CitationLinkProps {
  type: "session" | "source" | "repo" | "brief";
  label: string;
  onClick?: () => void;
}

export interface ParsedCitation {
  type: "session" | "source" | "repo" | "brief";
  label: string;
  fullMatch: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const COLORS: Record<CitationLinkProps["type"], string> = {
  session: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25",
  source: "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25",
  repo: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25",
  brief: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25",
};

const ICONS: Record<CitationLinkProps["type"], string> = {
  session: "\u26A1",
  source: "\uD83D\uDD17",
  repo: "\uD83D\uDCE6",
  brief: "\uD83D\uDCDD",
};

export const CITATION_REGEX = /\[(Session|Source|Repo|Brief)(?:: ([^\]]*))?\]/g;

// ── Component ──────────────────────────────────────────────────────────────

export function CitationLink({ type, label, onClick }: CitationLinkProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${COLORS[type]}`}
      title={`${type}: ${label}`}
    >
      <span>{ICONS[type]}</span>
      <span className="max-w-[200px] truncate">{label}</span>
    </button>
  );
}

// ── Parsing utility ────────────────────────────────────────────────────────

export function parseCitations(text: string): ParsedCitation[] {
  const results: ParsedCitation[] = [];
  const regex = new RegExp(CITATION_REGEX.source, "g");
  let match;

  while ((match = regex.exec(text)) !== null) {
    results.push({
      type: match[1].toLowerCase() as ParsedCitation["type"],
      label: match[2]?.trim() || match[1],
      fullMatch: match[0],
    });
  }

  return results;
}
