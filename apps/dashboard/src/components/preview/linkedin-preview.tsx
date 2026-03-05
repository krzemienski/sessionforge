"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const LINKEDIN_CHAR_LIMIT = 3000;
const SEE_MORE_THRESHOLD = 300;

// --- helpers ---

/**
 * Strip basic markdown syntax so content reads as LinkedIn-style plain text.
 * Preserves newlines for proper line-break rendering.
 */
function stripMarkdown(text: string): string {
  return text
    // Remove headings (# Heading)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove fenced code blocks, keeping inner text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, "$1")
    // Remove inline code
    .replace(/`([^`\n]+)`/g, "$1")
    // Remove bold/italic (**, __, *, _)
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, "$1")
    // Remove images (keep alt text)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Remove links (keep label)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove blockquote markers
    .replace(/^>\s?/gm, "")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Preserve list items — replace markers with bullets
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, (m) => m)
    .trim();
}

// --- sub-components ---

interface PostBodyProps {
  text: string;
}

function PostBody({ text }: PostBodyProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isLong = text.length > SEE_MORE_THRESHOLD;
  const displayText =
    isExpanded || !isLong ? text : text.slice(0, SEE_MORE_THRESHOLD);

  if (text.length === 0) {
    return (
      <p className="text-sm italic text-sf-text-muted">
        Start writing to see your LinkedIn post preview…
      </p>
    );
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-sf-text-primary whitespace-pre-wrap break-words">
        {displayText}
        {isLong && !isExpanded && (
          <span className="text-sf-text-muted">…</span>
        )}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-1 text-sm font-medium text-sf-text-secondary transition-colors hover:text-sf-text-primary"
        >
          {isExpanded ? "Show less" : "…see more"}
        </button>
      )}
    </>
  );
}

// --- LinkedInPreview ---

export interface LinkedInPreviewProps {
  markdown: string;
}

export function LinkedInPreview({ markdown }: LinkedInPreviewProps) {
  const postText = stripMarkdown(markdown);
  const charCount = postText.length;
  const isOverLimit = charCount > LINKEDIN_CHAR_LIMIT;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg p-6">
        {/* Preview label */}
        <div className="mb-4 flex items-center gap-2">
          <span className="font-display text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
            LinkedIn Preview
          </span>
        </div>

        {/* Post card */}
        <div className="rounded-sf-lg border border-sf-border bg-sf-bg-secondary p-5 transition-colors hover:border-sf-border-focus">
          {/* Profile header */}
          <div className="mb-4 flex items-center gap-3">
            {/* Avatar placeholder */}
            <div className="h-12 w-12 flex-shrink-0 rounded-full border border-sf-border bg-sf-bg-tertiary" />
            {/* Name / headline / connections placeholders */}
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-32 rounded-full bg-sf-bg-tertiary" />
              <div className="h-2.5 w-48 rounded-full bg-sf-bg-active" />
              <div className="h-2 w-20 rounded-full bg-sf-bg-active" />
            </div>
          </div>

          {/* Post body */}
          <div className="mb-4">
            <PostBody text={postText} />
          </div>

          {/* Footer: character count badge */}
          <div className="flex items-center justify-end border-t border-sf-border/50 pt-3">
            <span
              className={cn(
                "rounded-sf-full px-2 py-0.5 font-code text-xs font-medium tabular-nums",
                isOverLimit
                  ? "bg-sf-danger/15 text-sf-danger"
                  : "bg-sf-bg-tertiary text-sf-text-muted"
              )}
            >
              {charCount}/{LINKEDIN_CHAR_LIMIT}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
