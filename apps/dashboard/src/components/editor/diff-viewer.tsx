"use client";

import { useEffect, useMemo, useState } from "react";
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

// Flatten all segment lines to a simple string array for fence detection
function flattenSegmentLines(segments: Segment[]): string[] {
  const result: string[] = [];
  for (const segment of segments) {
    for (const line of segment.lines) {
      result.push(typeof line === "string" ? line : line.content);
    }
  }
  return result;
}

type FenceEntry = { language: string; isDelimiter: boolean };

// Detect markdown code fences and return a map from globalIndex -> fence info
function detectCodeFences(lines: string[]): Map<number, FenceEntry> {
  const map = new Map<number, FenceEntry>();
  let inFence = false;
  let language = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatch = line.match(/^```(\w*)\s*$/);

    if (!inFence && openMatch) {
      inFence = true;
      language = openMatch[1] ?? "";
      map.set(i, { language, isDelimiter: true });
    } else if (inFence && /^```\s*$/.test(line)) {
      map.set(i, { language, isDelimiter: true });
      inFence = false;
      language = "";
    } else if (inFence) {
      map.set(i, { language, isDelimiter: false });
    }
  }

  return map;
}

// Apply syntax highlighting to code fence blocks; returns map of globalIndex -> HTML
async function buildHighlightMap(segments: Segment[]): Promise<Map<number, string>> {
  const hlMap = new Map<number, string>();

  try {
    // highlight.js may resolve as the HLJSApi directly (ambient module)
    // or as a module with a .default export — handle both
    const hljsRaw: any = await import("highlight.js");
    const hljs: any = hljsRaw.default ?? hljsRaw;
    const allLines = flattenSegmentLines(segments);
    const fenceMap = detectCodeFences(allLines);

    // Walk through fence entries, grouping non-delimiter lines into blocks
    let blockLanguage = "";
    let blockLines: string[] = [];
    let blockIndices: number[] = [];

    const flushBlock = () => {
      if (blockLines.length === 0) return;
      const code = blockLines.join("\n");
      let highlighted: string;
      try {
        if (blockLanguage && hljs.getLanguage(blockLanguage)) {
          highlighted = hljs.highlight(code, { language: blockLanguage }).value;
        } else {
          highlighted = hljs.highlightAuto(code).value;
        }
      } catch {
        highlighted = code;
      }
      const highlightedLines = highlighted.split("\n");
      blockIndices.forEach((idx, i) => {
        hlMap.set(idx, highlightedLines[i] ?? "");
      });
      blockLines = [];
      blockIndices = [];
    };

    for (let i = 0; i < allLines.length; i++) {
      const fence = fenceMap.get(i);
      if (!fence) {
        // Not in a fence — flush any pending block
        if (blockLines.length > 0) {
          flushBlock();
        }
        continue;
      }
      if (fence.isDelimiter) {
        // Opener sets language; closer flushes current block
        if (blockLines.length > 0) {
          flushBlock();
        }
        blockLanguage = fence.language;
      } else {
        blockLines.push(allLines[i]);
        blockIndices.push(i);
      }
    }
    flushBlock();
  } catch {
    // highlight.js unavailable — return empty map (plain text fallback)
  }

  return hlMap;
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
  const [highlightMap, setHighlightMap] = useState<Map<number, string>>(new Map());

  // Compute per-segment start offsets for global line indexing
  const segmentOffsets = useMemo(() => {
    const offsets: number[] = [];
    let offset = 0;
    for (const segment of segments) {
      offsets.push(offset);
      offset += segment.lines.length;
    }
    return offsets;
  }, [segments]);

  // Lazily load highlight.js and compute highlighting on mount/content change
  useEffect(() => {
    let cancelled = false;
    buildHighlightMap(segments).then((map) => {
      if (!cancelled) setHighlightMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [segments]);

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

  return (
    <div className="font-mono text-xs rounded-sf-lg overflow-hidden border border-sf-border">
      {segments.map((segment, idx) => {
        const segOffset = segmentOffsets[idx] ?? 0;

        if (segment.type === "change") {
          return (
            <div key={idx}>
              {segment.lines.map((line, lineIdx) => {
                const gIdx = segOffset + lineIdx;
                const hlHtml = highlightMap.get(gIdx);
                return (
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
                    {renderLineContent(hlHtml, line.content)}
                  </div>
                );
              })}
            </div>
          );
        }

        if (segment.type === "context") {
          return (
            <div key={idx}>
              {segment.lines.map((line, lineIdx) => {
                const gIdx = segOffset + lineIdx;
                const hlHtml = highlightMap.get(gIdx);
                return (
                  <div
                    key={lineIdx}
                    className="flex items-start gap-2 px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                  >
                    <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                      {" "}
                    </span>
                    {renderLineContent(hlHtml, line)}
                  </div>
                );
              })}
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
                  {segment.lines.map((line, lineIdx) => {
                    const gIdx = segOffset + lineIdx;
                    const hlHtml = highlightMap.get(gIdx);
                    return (
                      <div
                        key={lineIdx}
                        className="flex items-start gap-2 px-3 py-0.5 leading-5 bg-sf-bg-secondary text-sf-text-secondary"
                      >
                        <span className="select-none w-4 flex-shrink-0 text-sf-text-muted text-center">
                          {" "}
                        </span>
                        {renderLineContent(hlHtml, line)}
                      </div>
                    );
                  })}
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
