"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { diffLines } from "diff";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildHighlightMapFromLines } from "@/lib/diff-highlight";

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

interface ColumnStreams {
  leftLines: string[];
  rightLines: string[];
  // For each row, the starting index into leftLines / rightLines
  // null means the row has no content for that column
  rowOffsets: Array<{ leftStart: number | null; rightStart: number | null }>;
}

/**
 * Build independent left and right line arrays from the side-by-side rows so
 * that fence detection and syntax highlighting can run on each column separately.
 *
 * Left column  = removed lines + context / collapsed lines (old content view)
 * Right column = added lines   + context / collapsed lines (new content view)
 */
function buildColumnStreams(rows: SideBySideRow[]): ColumnStreams {
  const leftLines: string[] = [];
  const rightLines: string[] = [];
  const rowOffsets: ColumnStreams["rowOffsets"] = [];

  for (const row of rows) {
    if (row.type === "change") {
      const leftStart = row.left !== null ? leftLines.length : null;
      const rightStart = row.right !== null ? rightLines.length : null;
      if (row.left !== null) leftLines.push(row.left.content);
      if (row.right !== null) rightLines.push(row.right.content);
      rowOffsets.push({ leftStart, rightStart });
    } else if (row.type === "context") {
      const leftStart = leftLines.length;
      const rightStart = rightLines.length;
      leftLines.push(row.content);
      rightLines.push(row.content);
      rowOffsets.push({ leftStart, rightStart });
    } else {
      // collapsed — same lines in both columns
      const leftStart = leftLines.length;
      const rightStart = rightLines.length;
      for (const line of row.lines) {
        leftLines.push(line);
        rightLines.push(line);
      }
      rowOffsets.push({ leftStart, rightStart });
    }
  }

  return { leftLines, rightLines, rowOffsets };
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

  const { leftLines, rightLines, rowOffsets } = useMemo(
    () => buildColumnStreams(rows),
    [rows]
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [leftHlMap, setLeftHlMap] = useState<Map<number, string>>(new Map());
  const [rightHlMap, setRightHlMap] = useState<Map<number, string>>(new Map());

  // Lazily load highlight.js and compute highlighting for each column independently
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      buildHighlightMapFromLines(leftLines),
      buildHighlightMapFromLines(rightLines),
    ]).then(([left, right]) => {
      if (!cancelled) {
        setLeftHlMap(left);
        setRightHlMap(right);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [leftLines, rightLines]);

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

  function renderLineContent(html: string | undefined, plainText: string) {
    if (html !== undefined) {
      return (
        <span
          className="whitespace-pre-wrap break-all flex-1"
          dangerouslySetInnerHTML={{ __html: html || "\u00a0" }}
        />
      );
    }
    return (
      <span className="whitespace-pre-wrap break-all flex-1">
        {plainText || "\u00a0"}
      </span>
    );
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
          const offsets = rowOffsets[idx];

          if (row.type === "change") {
            const leftHtml =
              offsets?.leftStart !== null && offsets?.leftStart !== undefined
                ? leftHlMap.get(offsets.leftStart)
                : undefined;
            const rightHtml =
              offsets?.rightStart !== null && offsets?.rightStart !== undefined
                ? rightHlMap.get(offsets.rightStart)
                : undefined;

            return (
              <Fragment key={idx}>
                {/* Left column (removed) */}
                <div
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
                      {renderLineContent(leftHtml, row.left.content)}
                    </div>
                  ) : (
                    <div className="h-full">&nbsp;</div>
                  )}
                </div>

                {/* Right column (added) */}
                <div
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
                      {renderLineContent(rightHtml, row.right.content)}
                    </div>
                  ) : (
                    <div className="h-full">&nbsp;</div>
                  )}
                </div>
              </Fragment>
            );
          }

          if (row.type === "context") {
            const leftHtml =
              offsets?.leftStart !== undefined && offsets.leftStart !== null
                ? leftHlMap.get(offsets.leftStart)
                : undefined;
            const rightHtml =
              offsets?.rightStart !== undefined && offsets.rightStart !== null
                ? rightHlMap.get(offsets.rightStart)
                : undefined;

            return (
              <Fragment key={idx}>
                <div
                  className="px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                >
                  <div className="flex items-start gap-2">
                    <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                      {" "}
                    </span>
                    {renderLineContent(leftHtml, row.content)}
                  </div>
                </div>
                <div
                  className="px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                >
                  <div className="flex items-start gap-2">
                    <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                      {" "}
                    </span>
                    {renderLineContent(rightHtml, row.content)}
                  </div>
                </div>
              </Fragment>
            );
          }

          if (row.type === "collapsed") {
            const isExpanded = expandedIds.has(row.id);
            const leftBaseIdx = offsets?.leftStart ?? null;
            const rightBaseIdx = offsets?.rightStart ?? null;

            return (
              <Fragment key={idx}>
                <button
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
                  row.lines.map((line, lineIdx) => {
                    const leftHtml =
                      leftBaseIdx !== null
                        ? leftHlMap.get(leftBaseIdx + lineIdx)
                        : undefined;
                    const rightHtml =
                      rightBaseIdx !== null
                        ? rightHlMap.get(rightBaseIdx + lineIdx)
                        : undefined;

                    return (
                      <Fragment key={`${idx}-${lineIdx}`}>
                        <div
                          className="px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                        >
                          <div className="flex items-start gap-2">
                            <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                              {" "}
                            </span>
                            {renderLineContent(leftHtml, line)}
                          </div>
                        </div>
                        <div
                          className="px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                        >
                          <div className="flex items-start gap-2">
                            <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                              {" "}
                            </span>
                            {renderLineContent(rightHtml, line)}
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
