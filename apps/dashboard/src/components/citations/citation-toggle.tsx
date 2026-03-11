"use client";

import { useState, useEffect } from "react";
import { Quote, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { CitationExtractor } from "@/lib/citations/extractor";

interface CitationToggleProps {
  /**
   * The markdown content containing citation markers
   */
  markdown: string;

  /**
   * Whether citations are currently enabled/visible
   */
  enabled: boolean;

  /**
   * Callback when citation visibility changes
   */
  onToggle: (enabled: boolean) => void;

  /**
   * Optional refresh key to trigger re-analysis
   */
  refreshKey?: number;
}

export function CitationToggle({
  markdown,
  enabled,
  onToggle,
  refreshKey,
}: CitationToggleProps) {
  const [citationCount, setCitationCount] = useState(0);
  const [uniqueSessions, setUniqueSessions] = useState(0);

  // Analyze markdown for citation statistics
  useEffect(() => {
    const extractor = new CitationExtractor();
    const citations = extractor.extract(markdown);
    setCitationCount(citations.length);

    // Count unique sessions
    const sessions = new Set(citations.map(c => c.sessionId));
    setUniqueSessions(sessions.size);
  }, [markdown, refreshKey]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">
          Citations
        </h3>
        <div className="flex items-center gap-2">
          {enabled ? (
            <Eye size={14} className="text-sf-accent" />
          ) : (
            <EyeOff size={14} className="text-sf-text-muted" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {/* Toggle Control */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="rounded border-sf-border bg-sf-bg-tertiary text-sf-accent focus:ring-sf-accent"
            />
            <span className="text-sm text-sf-text-primary">
              Show evidence citations
            </span>
          </label>
          <p className="text-xs text-sf-text-muted ml-7">
            Display citation markers and links to source sessions in the editor
          </p>
        </div>

        {/* Citation Statistics */}
        <div className="space-y-3 pt-3 border-t border-sf-border">
          <p className="text-xs font-medium text-sf-text-secondary">Statistics</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-sf-text-muted">Total Citations</span>
              <span className={cn(
                "text-sm font-semibold font-display",
                citationCount > 0 ? "text-sf-accent" : "text-sf-text-muted"
              )}>
                {citationCount}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-sf-text-muted">Source Sessions</span>
              <span className={cn(
                "text-sm font-semibold font-display",
                uniqueSessions > 0 ? "text-sf-accent" : "text-sf-text-muted"
              )}>
                {uniqueSessions}
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        {citationCount === 0 && (
          <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-3 space-y-1">
            <div className="flex items-start gap-2">
              <Quote size={14} className="text-sf-text-muted flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-sf-text-primary">
                  No citations detected
                </p>
                <p className="text-xs text-sf-text-muted">
                  Citations are automatically generated when content is created from sessions.
                  Add citation markers manually using the format [@sessionId:messageIndex].
                </p>
              </div>
            </div>
          </div>
        )}

        {citationCount > 0 && enabled && (
          <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-3">
            <p className="text-xs text-sf-text-secondary">
              Citations link claims in your content back to specific moments in the source coding session,
              building reader trust and making your AI-generated content verifiable.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
