"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { cn } from "@/lib/utils";
import { Search, ScrollText, Lightbulb, FileText, X, Loader2 } from "lucide-react";

interface GlobalSearchModalProps {
  workspace: string;
  onClose: () => void;
}

const SUGGESTIONS = ["React", "debugging", "architecture", "TypeScript", "performance"];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-sf-accent/20 text-sf-accent rounded-sm px-0.5 not-italic font-medium"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface ResultGroupProps {
  label: string;
  icon: React.ReactNode;
  items: any[];
  query: string;
  activeIndex: number;
  globalOffset: number;
  onSelect: (id: string) => void;
}

function ResultGroup({
  label,
  icon,
  items,
  query,
  activeIndex,
  globalOffset,
  onSelect,
}: ResultGroupProps) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-sf-text-muted font-display uppercase tracking-wide">
        {icon}
        {label}
      </div>
      {items.map((item, i) => {
        const flatIdx = globalOffset + i;
        const isActive = flatIdx === activeIndex;
        const title = item.projectName ?? item.title ?? "Untitled";
        const snippet: string = item.snippet ?? "";
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              "w-full text-left px-4 py-3 transition-colors",
              isActive
                ? "bg-sf-accent-bg"
                : "hover:bg-sf-bg-hover"
            )}
          >
            <p className="text-sm font-medium font-display truncate text-sf-text-primary">
              <HighlightMatch text={title} query={query} />
            </p>
            {snippet && (
              <p className="text-xs text-sf-text-secondary mt-0.5 line-clamp-2 font-body">
                <HighlightMatch text={snippet} query={query} />
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function GlobalSearchModal({ workspace, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { sessions, insights, content, isLoading } = useGlobalSearch(query, workspace);

  const allResults = useMemo(() => {
    const results: Array<{ type: "session" | "insight" | "content"; item: any }> = [];
    for (const item of sessions) results.push({ type: "session", item });
    for (const item of insights) results.push({ type: "insight", item });
    for (const item of content) results.push({ type: "content", item });
    return results;
  }, [sessions, insights, content]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const navigate = useCallback(
    (type: string, id: string) => {
      const paths: Record<string, string> = {
        session: `/${workspace}/sessions/${id}`,
        insight: `/${workspace}/insights/${id}`,
        content: `/${workspace}/content/${id}`,
      };
      router.push(paths[type]);
      onClose();
    },
    [workspace, router, onClose]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (allResults.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i < allResults.length - 1 ? i + 1 : i));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : 0));
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < allResults.length) {
          const result = allResults[activeIndex];
          navigate(result.type, result.item.id);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, allResults, navigate, onClose]);

  const hasResults = sessions.length > 0 || insights.length > 0 || content.length > 0;
  const showEmpty = query.length >= 2 && !isLoading && !hasResults;
  const showSuggestions = query.length < 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-sf-bg-primary/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <div className="w-full max-w-2xl mx-4 bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-[var(--shadow-sf-lg)] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-sf-border">
          <Search size={18} className="text-sf-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search sessions, insights, content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sf-text-primary placeholder:text-sf-text-muted text-sm focus:outline-none font-body"
          />
          {isLoading && (
            <Loader2 size={16} className="text-sf-text-muted animate-spin flex-shrink-0" />
          )}
          <button
            onClick={onClose}
            className="text-sf-text-muted hover:text-sf-text-secondary transition-colors"
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto">
          {showSuggestions && (
            <div className="p-4">
              <p className="text-xs text-sf-text-muted mb-3 font-display">
                Try searching for...
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="px-3 py-1.5 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-secondary hover:border-sf-border-focus hover:text-sf-text-primary transition-colors font-body"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showEmpty && (
            <div className="p-8 text-center">
              <Search size={32} className="mx-auto text-sf-text-muted mb-3" />
              <p className="text-sf-text-secondary text-sm font-body">
                No results for{" "}
                <span className="text-sf-text-primary font-medium">&ldquo;{query}&rdquo;</span>
              </p>
              <p className="text-sf-text-muted text-xs mt-1 font-body">
                Try searching for React, debugging, or architecture
              </p>
            </div>
          )}

          {hasResults && (
            <div className="py-2">
              {sessions.length > 0 && (
                <ResultGroup
                  label="Sessions"
                  icon={<ScrollText size={14} />}
                  items={sessions}
                  query={query}
                  activeIndex={activeIndex}
                  globalOffset={0}
                  onSelect={(id) => navigate("session", id)}
                />
              )}
              {insights.length > 0 && (
                <ResultGroup
                  label="Insights"
                  icon={<Lightbulb size={14} />}
                  items={insights}
                  query={query}
                  activeIndex={activeIndex}
                  globalOffset={sessions.length}
                  onSelect={(id) => navigate("insight", id)}
                />
              )}
              {content.length > 0 && (
                <ResultGroup
                  label="Content"
                  icon={<FileText size={14} />}
                  items={content}
                  query={query}
                  activeIndex={activeIndex}
                  globalOffset={sessions.length + insights.length}
                  onSelect={(id) => navigate("content", id)}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer keyboard hints */}
        <div className="px-4 py-2 border-t border-sf-border flex items-center gap-4 text-xs text-sf-text-muted font-body">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-sf-bg-tertiary border border-sf-border rounded text-[10px]">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-sf-bg-tertiary border border-sf-border rounded text-[10px]">
              ↵
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-sf-bg-tertiary border border-sf-border rounded text-[10px]">
              Esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
