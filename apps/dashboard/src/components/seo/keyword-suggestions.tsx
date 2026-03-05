"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeoData {
  keywords: string[] | null;
}

interface KeywordSuggestionsProps {
  postId: string;
}

/**
 * Infers a rough search intent for a keyword.
 *
 * - "informational" — question-like or "how/what/why" phrasing
 * - "navigational"  — short, brand-specific, or proper-noun style
 */
function inferIntent(keyword: string): "informational" | "navigational" {
  const lower = keyword.toLowerCase();
  const informationalPrefixes = ["how", "what", "why", "when", "where", "guide", "tutorial", "tips", "best"];
  for (const prefix of informationalPrefixes) {
    if (lower.startsWith(prefix) || lower.includes(` ${prefix} `)) {
      return "informational";
    }
  }
  // Multi-word phrases lean informational; short single words lean navigational
  return keyword.trim().includes(" ") ? "informational" : "navigational";
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

function IntentBadge({ intent }: { intent: "informational" | "navigational" }) {
  return (
    <span
      className={cn(
        "text-[10px] px-1 py-0.5 rounded leading-none",
        intent === "informational"
          ? "bg-blue-500/10 text-blue-400"
          : "bg-purple-500/10 text-purple-400"
      )}
    >
      {intent === "informational" ? "info" : "nav"}
    </span>
  );
}

export function KeywordSuggestions({ postId }: KeywordSuggestionsProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/content/${postId}/seo`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<SeoData>;
      })
      .then((json) => {
        if (!cancelled) {
          setKeywords(json?.keywords ?? []);
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

  async function persistKeywords(next: string[]) {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/content/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: next }),
      });

      if (!res.ok) {
        throw new Error("Failed to save keywords");
      }

      setKeywords(next);
    } catch {
      setError("Could not save keywords. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleRemove(keyword: string) {
    const next = keywords.filter((k) => k !== keyword);
    void persistKeywords(next);
  }

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed || keywords.includes(trimmed)) {
      setInputValue("");
      return;
    }

    setInputValue("");
    const next = [...keywords, trimmed];
    void persistKeywords(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === "Escape") {
      setInputValue("");
      inputRef.current?.blur();
    }
  }

  if (loading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
        <SkeletonLine className="w-32" />
        <div className="flex flex-wrap gap-1.5">
          <SkeletonLine className="w-20 h-6" />
          <SkeletonLine className="w-28 h-6" />
          <SkeletonLine className="w-16 h-6" />
          <SkeletonLine className="w-24 h-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Tag size={13} className="text-sf-text-muted flex-shrink-0" />
        <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          Keyword Suggestions
        </h3>
        {saving && (
          <span className="ml-auto text-xs text-sf-text-muted animate-pulse">
            Saving…
          </span>
        )}
      </div>

      {/* Keyword tags */}
      {keywords.length === 0 ? (
        <p className="text-sm text-sf-text-muted">
          No keywords yet. Run SEO analysis or add keywords manually below.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((kw) => {
            const intent = inferIntent(kw);
            return (
              <div
                key={kw}
                className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded bg-sf-bg-tertiary border border-sf-border group"
              >
                <span className="font-code text-xs text-sf-text-secondary">
                  {kw}
                </span>
                <IntentBadge intent={intent} />
                <button
                  onClick={() => handleRemove(kw)}
                  disabled={saving}
                  aria-label={`Remove keyword: ${kw}`}
                  className="ml-0.5 text-sf-text-muted hover:text-red-400 disabled:opacity-40 transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add keyword input */}
      <div className="flex gap-1.5 pt-1">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a keyword…"
          disabled={saving}
          className={cn(
            "flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded",
            "bg-sf-bg-primary border border-sf-border",
            "text-sf-text-primary placeholder:text-sf-text-muted",
            "focus:outline-none focus:border-sf-accent transition-colors",
            "disabled:opacity-40"
          )}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !inputValue.trim()}
          aria-label="Add keyword"
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded text-xs",
            "bg-sf-accent text-white",
            "hover:opacity-90 disabled:opacity-40 transition-opacity"
          )}
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Intent legend */}
      <div className="flex items-center gap-3 pt-0.5">
        <span className="text-xs text-sf-text-muted">Intent:</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">info</span>
          <span className="text-xs text-sf-text-muted">Informational</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">nav</span>
          <span className="text-xs text-sf-text-muted">Navigational</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
