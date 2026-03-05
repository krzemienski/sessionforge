"use client";

import React, { useMemo } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { ToolCallBlock } from "./tool-call-block";
import { DiffBlock } from "./diff-block";
import { CodeBlock } from "./code-block";

// ── Type definitions ──────────────────────────────────────────────────────────

interface TextContent {
  type: "text";
  text: string;
}

interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string | Array<{ type: string; text: string }>;
  is_error?: boolean;
}

type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

export interface RawSessionEntry {
  type?: string;
  role?: "human" | "assistant";
  content?: string | ContentBlock[];
  timestamp?: string;
  summary?: string;
  isSidechain?: boolean;
}

// ── Code fence parser ─────────────────────────────────────────────────────────

type TextSegment =
  | { type: "text"; content: string }
  | { type: "code"; language: string; content: string };

const CODE_FENCE_RE = /```(\w*)\n([\s\S]*?)```/g;

function parseTextSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Reset the regex lastIndex before each use
  const re = new RegExp(CODE_FENCE_RE.source, CODE_FENCE_RE.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      language: match[1] || "text",
      content: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}

// ── Search highlight helper ───────────────────────────────────────────────────

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-sf-warning/30 text-sf-warning rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// ── TextBlock: renders a text content block with code fence splitting ─────────

interface TextBlockProps {
  text: string;
  searchQuery: string;
}

function TextBlock({ text, searchQuery }: TextBlockProps) {
  const segments = useMemo(() => parseTextSegments(text), [text]);

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        if (seg.type === "code") {
          return <CodeBlock key={i} code={seg.content} language={seg.language} />;
        }
        const trimmed = seg.content.trim();
        if (!trimmed) return null;
        return (
          <p key={i} className="text-sf-text-primary whitespace-pre-wrap break-words">
            {searchQuery ? highlightText(trimmed, searchQuery) : trimmed}
          </p>
        );
      })}
    </div>
  );
}

// ── EditToolBlock: renders Edit/MultiEdit as DiffBlock(s) ────────────────────

const DIFF_TOOLS = new Set(["Edit", "MultiEdit"]);

interface EditToolBlockProps {
  toolName: string;
  input: Record<string, unknown>;
}

function EditToolBlock({ toolName, input }: EditToolBlockProps) {
  const filePath = input.file_path as string | undefined;

  if (toolName === "Edit") {
    const oldString = input.old_string as string | undefined;
    const newString = input.new_string as string | undefined;
    if (oldString != null && newString != null) {
      return <DiffBlock oldString={oldString} newString={newString} filePath={filePath} />;
    }
  }

  if (toolName === "MultiEdit") {
    const edits = input.edits as Array<{ old_string: string; new_string: string }> | undefined;
    if (edits?.length) {
      return (
        <div className="space-y-2">
          {edits.map((edit, i) => (
            <DiffBlock
              key={i}
              oldString={edit.old_string}
              newString={edit.new_string}
              filePath={
                filePath
                  ? edits.length > 1
                    ? `${filePath} (edit ${i + 1}/${edits.length})`
                    : filePath
                  : undefined
              }
            />
          ))}
        </div>
      );
    }
  }

  // Fallback: render as a regular tool call block
  return <ToolCallBlock toolName={toolName} input={input} />;
}

// ── ToolResultPanel: compact display of tool result content ──────────────────

interface ToolResultPanelProps {
  block: ToolResultContent;
}

function ToolResultPanel({ block }: ToolResultPanelProps) {
  const resultContent = useMemo(() => {
    if (typeof block.content === "string") return block.content;
    if (Array.isArray(block.content)) {
      return block.content
        .map((c) => (typeof c === "object" && "text" in c ? c.text : ""))
        .join("\n");
    }
    return "";
  }, [block.content]);

  if (!resultContent.trim()) return null;

  const truncated =
    resultContent.length > 500
      ? resultContent.slice(0, 500) + "\n… (truncated)"
      : resultContent;

  return (
    <div
      className={cn(
        "rounded-sf border text-xs font-code px-3 py-2",
        block.is_error
          ? "border-sf-danger/30 bg-sf-danger/5"
          : "border-sf-border bg-sf-bg-primary"
      )}
    >
      <span
        className={cn(
          "uppercase tracking-wider text-xs block mb-1",
          block.is_error ? "text-sf-danger" : "text-sf-text-muted"
        )}
      >
        {block.is_error ? "error" : "result"}
      </span>
      <pre
        className={cn(
          "whitespace-pre-wrap break-all",
          block.is_error ? "text-sf-danger" : "text-sf-text-secondary"
        )}
      >
        {truncated}
      </pre>
    </div>
  );
}

// ── Main TranscriptMessage component ─────────────────────────────────────────

export interface TranscriptMessageProps {
  entry: RawSessionEntry;
  messageIndex: number;
  isBookmarked: boolean;
  onBookmark: (index: number, label: string) => void;
  searchQuery?: string;
  searchMatchRef?: React.Ref<HTMLDivElement>;
}

export function TranscriptMessage({
  entry,
  messageIndex,
  isBookmarked,
  onBookmark,
  searchQuery = "",
  searchMatchRef,
}: TranscriptMessageProps) {
  // Normalize content to a ContentBlock array (hooks must be called unconditionally)
  const contentBlocks: ContentBlock[] = useMemo(() => {
    if (Array.isArray(entry.content)) return entry.content;
    if (typeof entry.content === "string") {
      return [{ type: "text" as const, text: entry.content }];
    }
    return [];
  }, [entry.content]);

  // Determine if this entry contains any text matching the active search
  const hasSearchMatch = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return contentBlocks.some(
      (block) => block.type === "text" && block.text.toLowerCase().includes(q)
    );
  }, [contentBlocks, searchQuery]);

  // ── Summary entry ──────────────────────────────────────────────────────────
  if (entry.type === "summary" || (entry.summary && !entry.role)) {
    const summaryText = entry.summary ?? "";
    return (
      <div className="py-1">
        <div className="flex items-center gap-3 bg-sf-bg-tertiary/40 border border-dashed border-sf-border rounded-sf-lg px-4 py-2.5">
          <span className="text-xs font-medium text-sf-text-muted uppercase tracking-wider shrink-0 select-none">
            Summary
          </span>
          <p className="text-xs text-sf-text-secondary flex-1 break-words">
            {searchQuery ? highlightText(summaryText, searchQuery) : summaryText}
          </p>
        </div>
      </div>
    );
  }

  const isHuman = entry.role === "human";

  const handleBookmark = () => {
    onBookmark(messageIndex, `Message ${messageIndex + 1}`);
  };

  return (
    <div
      ref={hasSearchMatch ? (searchMatchRef as React.Ref<HTMLDivElement>) : undefined}
      className={cn(
        "group relative rounded-sf-lg p-4 text-sm",
        isHuman
          ? "bg-sf-bg-tertiary mr-12"
          : "bg-sf-bg-secondary border border-sf-border ml-12"
      )}
    >
      {/* Header: role label + timestamp + bookmark button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-medium uppercase tracking-wider",
              isHuman ? "text-sf-text-secondary" : "text-sf-accent"
            )}
          >
            {isHuman ? "You" : "Assistant"}
          </span>
          {entry.timestamp && (
            <span className="text-xs text-sf-text-muted">
              · {timeAgo(entry.timestamp)}
            </span>
          )}
        </div>

        <button
          onClick={handleBookmark}
          className={cn(
            "transition-opacity p-1 rounded-sf hover:bg-sf-bg-hover",
            isBookmarked
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          )}
          aria-label={isBookmarked ? "Bookmarked" : "Bookmark this message"}
          title={isBookmarked ? "Bookmarked" : "Bookmark this message"}
        >
          {isBookmarked ? (
            <BookmarkCheck size={14} className="text-sf-accent" />
          ) : (
            <Bookmark size={14} className="text-sf-text-muted" />
          )}
        </button>
      </div>

      {/* Content blocks */}
      <div className="space-y-3">
        {contentBlocks.map((block, i) => {
          if (block.type === "text") {
            return (
              <TextBlock key={i} text={block.text} searchQuery={searchQuery} />
            );
          }

          if (block.type === "tool_use") {
            if (DIFF_TOOLS.has(block.name)) {
              return (
                <EditToolBlock
                  key={block.id}
                  toolName={block.name}
                  input={block.input}
                />
              );
            }
            return (
              <ToolCallBlock
                key={block.id}
                toolName={block.name}
                input={block.input}
              />
            );
          }

          if (block.type === "tool_result") {
            return <ToolResultPanel key={i} block={block} />;
          }

          return null;
        })}
      </div>
    </div>
  );
}
