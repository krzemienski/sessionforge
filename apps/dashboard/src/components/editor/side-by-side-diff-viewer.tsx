"use client";

import { useMemo, useState } from "react";
import { diffLines } from "diff";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SideBySideDiffViewerProps {
  fromContent: string;
  toContent: string;
  contextLines?: number;
}

type SideBySideRow =
  | {
      type: "change";
      left: { content: string; isRemoved: boolean } | null;
      right: { content: string; isAdded: boolean } | null;
    }
  | { type: "context"; content: string }
  | { type: "collapsed"; lines: string[]; id: string };

function computeSideBySideRows(
  fromContent: string,
  toContent: string,
  contextLines: number
): SideBySideRow[] {
  const changes = diffLines(fromContent, toContent);

  // First, convert to a flat list of lines with types
  type RawLine = { type: "added" | "removed" | "unchanged"; content: string };
  const lines: RawLine[] = [];

  for (const change of changes) {
    const lineTexts = change.value.split("\n");
    const filtered =
      lineTexts.length > 0 && lineTexts[lineTexts.length - 1] === ""
        ? lineTexts.slice(0, -1)
        : lineTexts;
    const type = change.added ? "added" : change.removed ? "removed" : "unchanged";
    for (const line of filtered) {
      lines.push({ type, content: line });
    }
  }

  if (lines.length === 0) return [];

  // Mark which unchanged lines are within contextLines of a change
  const shouldShow = new Array<boolean>(lines.length).fill(false);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== "unchanged") {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      for (let j = start; j <= end; j++) {
        shouldShow[j] = true;
      }
    }
  }

  const rows: SideBySideRow[] = [];
  let i = 0;
  let collapseId = 0;

  while (i < lines.length) {
    if (lines[i].type !== "unchanged") {
      // Collect consecutive removed and added lines
      const removedLines: string[] = [];
      const addedLines: string[] = [];

      while (i < lines.length && lines[i].type !== "unchanged") {
        if (lines[i].type === "removed") {
          removedLines.push(lines[i].content);
        } else if (lines[i].type === "added") {
          addedLines.push(lines[i].content);
        }
        i++;
      }

      // Create side-by-side rows: pair up removed/added lines
      const maxLen = Math.max(removedLines.length, addedLines.length);
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          type: "change",
          left:
            j < removedLines.length
              ? { content: removedLines[j], isRemoved: true }
              : null,
          right:
            j < addedLines.length ? { content: addedLines[j], isAdded: true } : null,
        });
      }
    } else if (shouldShow[i]) {
      // Visible context lines
      while (i < lines.length && lines[i].type === "unchanged" && shouldShow[i]) {
        rows.push({ type: "context", content: lines[i].content });
        i++;
      }
    } else {
      // Collapsed unchanged lines
      const collapsedLines: string[] = [];
      while (i < lines.length && lines[i].type === "unchanged" && !shouldShow[i]) {
        collapsedLines.push(lines[i].content);
        i++;
      }
      rows.push({
        type: "collapsed",
        lines: collapsedLines,
        id: `collapse-${collapseId++}`,
      });
    }
  }

  return rows;
}

export function SideBySideDiffViewer({
  fromContent,
  toContent,
  contextLines = 3,
}: SideBySideDiffViewerProps) {
  const rows = useMemo(
    () => computeSideBySideRows(fromContent, toContent, contextLines),
    [fromContent, toContent, contextLines]
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleCollapse(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const hasChanges = rows.some((r) => r.type === "change");

  if (!hasChanges) {
    return (
      <div className="flex items-center justify-center py-12 text-sf-text-muted text-sm">
        No differences between these versions.
      </div>
    );
  }

  return (
    <div className="font-mono text-xs rounded-sf-lg overflow-hidden border border-sf-border">
      <div className="grid grid-cols-2 gap-px bg-sf-border">
        {/* Column headers */}
        <div className="bg-sf-bg-tertiary px-3 py-2 text-sf-text-secondary font-semibold border-b border-sf-border">
          Original
        </div>
        <div className="bg-sf-bg-tertiary px-3 py-2 text-sf-text-secondary font-semibold border-b border-sf-border">
          Modified
        </div>

        {/* Diff content */}
        {rows.map((row, idx) => {
          if (row.type === "change") {
            return (
              <>
                {/* Left column (removed) */}
                <div
                  key={`${idx}-left`}
                  className={cn(
                    "px-3 py-0.5 leading-5 min-h-[1.25rem]",
                    row.left
                      ? "bg-sf-danger/15 text-sf-text-primary"
                      : "bg-sf-bg-secondary"
                  )}
                >
                  {row.left ? (
                    <div className="flex items-start gap-2">
                      <span className="select-none w-4 flex-shrink-0 font-bold text-sf-danger text-center">
                        −
                      </span>
                      <span className="whitespace-pre-wrap break-all flex-1">
                        {row.left.content || "\u00a0"}
                      </span>
                    </div>
                  ) : (
                    <div className="h-full">&nbsp;</div>
                  )}
                </div>

                {/* Right column (added) */}
                <div
                  key={`${idx}-right`}
                  className={cn(
                    "px-3 py-0.5 leading-5 min-h-[1.25rem]",
                    row.right
                      ? "bg-sf-success/15 text-sf-text-primary"
                      : "bg-sf-bg-secondary"
                  )}
                >
                  {row.right ? (
                    <div className="flex items-start gap-2">
                      <span className="select-none w-4 flex-shrink-0 font-bold text-sf-success text-center">
                        +
                      </span>
                      <span className="whitespace-pre-wrap break-all flex-1">
                        {row.right.content || "\u00a0"}
                      </span>
                    </div>
                  ) : (
                    <div className="h-full">&nbsp;</div>
                  )}
                </div>
              </>
            );
          }

          if (row.type === "context") {
            return (
              <>
                <div
                  key={`${idx}-left`}
                  className="px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                >
                  <div className="flex items-start gap-2">
                    <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                      {" "}
                    </span>
                    <span className="whitespace-pre-wrap break-all flex-1">
                      {row.content || "\u00a0"}
                    </span>
                  </div>
                </div>
                <div
                  key={`${idx}-right`}
                  className="px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                >
                  <div className="flex items-start gap-2">
                    <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                      {" "}
                    </span>
                    <span className="whitespace-pre-wrap break-all flex-1">
                      {row.content || "\u00a0"}
                    </span>
                  </div>
                </div>
              </>
            );
          }

          if (row.type === "collapsed") {
            const isExpanded = expandedIds.has(row.id);
            return (
              <>
                <button
                  key={`${idx}-collapse-btn`}
                  onClick={() => toggleCollapse(row.id)}
                  className="col-span-2 flex items-center gap-2 px-3 py-1.5 bg-sf-bg-tertiary hover:bg-sf-bg-hover text-sf-text-muted transition-colors border-y border-sf-border/50"
                >
                  {isExpanded ? (
                    <ChevronDown size={12} className="flex-shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="flex-shrink-0" />
                  )}
                  <span>
                    {isExpanded
                      ? "Collapse unchanged lines"
                      : `${row.lines.length} unchanged line${row.lines.length !== 1 ? "s" : ""}`}
                  </span>
                </button>

                {isExpanded &&
                  row.lines.map((line, lineIdx) => (
                    <>
                      <div
                        key={`${idx}-${lineIdx}-left`}
                        className="px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                      >
                        <div className="flex items-start gap-2">
                          <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                            {" "}
                          </span>
                          <span className="whitespace-pre-wrap break-all flex-1">
                            {line || "\u00a0"}
                          </span>
                        </div>
                      </div>
                      <div
                        key={`${idx}-${lineIdx}-right`}
                        className="px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                      >
                        <div className="flex items-start gap-2">
                          <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                            {" "}
                          </span>
                          <span className="whitespace-pre-wrap break-all flex-1">
                            {line || "\u00a0"}
                          </span>
                        </div>
                      </div>
                    </>
                  ))}
              </>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
