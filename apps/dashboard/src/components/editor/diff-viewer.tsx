"use client";

import { useMemo, useState } from "react";
import { diffLines } from "diff";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  fromContent: string;
  toContent: string;
  contextLines?: number;
}

type RawLine = { type: "added" | "removed" | "unchanged"; content: string };

type Segment =
  | { type: "change"; lines: RawLine[] }
  | { type: "context"; lines: string[] }
  | { type: "collapsed"; lines: string[]; id: string };

function computeSegments(
  fromContent: string,
  toContent: string,
  contextLines: number
): Segment[] {
  const changes = diffLines(fromContent, toContent);

  const lines: RawLine[] = [];
  for (const change of changes) {
    const lineTexts = change.value.split("\n");
    // Remove trailing empty string produced by a trailing newline
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

  const segments: Segment[] = [];
  let i = 0;
  let collapseId = 0;

  while (i < lines.length) {
    if (lines[i].type !== "unchanged") {
      // Collect consecutive added/removed lines into one change segment
      const changeLines: RawLine[] = [];
      while (i < lines.length && lines[i].type !== "unchanged") {
        changeLines.push(lines[i]);
        i++;
      }
      segments.push({ type: "change", lines: changeLines });
    } else if (shouldShow[i]) {
      // Visible context lines around a change
      const contextLinesList: string[] = [];
      while (i < lines.length && lines[i].type === "unchanged" && shouldShow[i]) {
        contextLinesList.push(lines[i].content);
        i++;
      }
      segments.push({ type: "context", lines: contextLinesList });
    } else {
      // Unchanged lines far from any change — collapse them
      const collapsedLines: string[] = [];
      while (i < lines.length && lines[i].type === "unchanged" && !shouldShow[i]) {
        collapsedLines.push(lines[i].content);
        i++;
      }
      segments.push({
        type: "collapsed",
        lines: collapsedLines,
        id: `collapse-${collapseId++}`,
      });
    }
  }

  return segments;
}

export function DiffViewer({
  fromContent,
  toContent,
  contextLines = 3,
}: DiffViewerProps) {
  const segments = useMemo(
    () => computeSegments(fromContent, toContent, contextLines),
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

  const hasChanges = segments.some((s) => s.type === "change");

  if (!hasChanges) {
    return (
      <div className="flex items-center justify-center py-12 text-sf-text-muted text-sm">
        No differences between these versions.
      </div>
    );
  }

  return (
    <div className="font-mono text-xs rounded-sf-lg overflow-hidden border border-sf-border">
      {segments.map((segment, idx) => {
        if (segment.type === "change") {
          return (
            <div key={idx}>
              {segment.lines.map((line, lineIdx) => (
                <div
                  key={lineIdx}
                  className={cn(
                    "flex items-start gap-2 px-3 py-0.5 leading-5",
                    line.type === "added"
                      ? "bg-sf-success/15 text-sf-text-primary"
                      : "bg-sf-danger/15 text-sf-text-primary"
                  )}
                >
                  <span
                    className={cn(
                      "select-none w-4 flex-shrink-0 font-bold text-center",
                      line.type === "added" ? "text-sf-success" : "text-sf-danger"
                    )}
                  >
                    {line.type === "added" ? "+" : "−"}
                  </span>
                  <span className="whitespace-pre-wrap break-all flex-1">
                    {line.content || "\u00a0"}
                  </span>
                </div>
              ))}
            </div>
          );
        }

        if (segment.type === "context") {
          return (
            <div key={idx}>
              {segment.lines.map((line, lineIdx) => (
                <div
                  key={lineIdx}
                  className="flex items-start gap-2 px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                >
                  <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                    {" "}
                  </span>
                  <span className="whitespace-pre-wrap break-all flex-1">
                    {line || "\u00a0"}
                  </span>
                </div>
              ))}
            </div>
          );
        }

        if (segment.type === "collapsed") {
          const isExpanded = expandedIds.has(segment.id);
          return (
            <div key={idx}>
              <button
                onClick={() => toggleCollapse(segment.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-sf-bg-tertiary hover:bg-sf-bg-hover text-sf-text-muted transition-colors border-y border-sf-border/50"
              >
                {isExpanded ? (
                  <ChevronDown size={12} className="flex-shrink-0" />
                ) : (
                  <ChevronRight size={12} className="flex-shrink-0" />
                )}
                <span>
                  {isExpanded
                    ? "Collapse unchanged lines"
                    : `${segment.lines.length} unchanged line${segment.lines.length !== 1 ? "s" : ""}`}
                </span>
              </button>
              {isExpanded && (
                <div>
                  {segment.lines.map((line, lineIdx) => (
                    <div
                      key={lineIdx}
                      className="flex items-start gap-2 px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                    >
                      <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                        {" "}
                      </span>
                      <span className="whitespace-pre-wrap break-all flex-1">
                        {line || "\u00a0"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
