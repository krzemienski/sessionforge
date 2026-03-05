"use client";

import { useMemo } from "react";
import { diffLines } from "diff";
import { cn } from "@/lib/utils";

interface DiffBlockProps {
  oldString: string;
  newString: string;
  filePath?: string;
  className?: string;
}

export function DiffBlock({ oldString, newString, filePath, className }: DiffBlockProps) {
  const changes = useMemo(() => diffLines(oldString, newString), [oldString, newString]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const change of changes) {
      const lineCount = change.value.split("\n").filter((l, i, arr) =>
        // Don't count trailing empty string from a trailing newline
        !(i === arr.length - 1 && l === "")
      ).length;
      if (change.added) added += lineCount;
      else if (change.removed) removed += lineCount;
    }
    return { added, removed };
  }, [changes]);

  return (
    <div className={cn("rounded-sf-lg border border-sf-border overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-sf-border bg-sf-bg-secondary">
        <span className="text-xs font-code text-sf-text-muted uppercase tracking-wider truncate">
          {filePath ?? "diff"}
        </span>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {stats.removed > 0 && (
            <span className="text-xs font-code text-sf-danger">
              -{stats.removed}
            </span>
          )}
          {stats.added > 0 && (
            <span className="text-xs font-code text-sf-success">
              +{stats.added}
            </span>
          )}
        </div>
      </div>

      {/* Diff lines */}
      <div className="overflow-x-auto bg-sf-bg-tertiary">
        <table className="w-full border-collapse text-xs font-code leading-relaxed">
          <tbody>
            {changes.map((change, changeIndex) => {
              const lines = change.value.split("\n");
              // Remove last empty string from trailing newline
              if (lines[lines.length - 1] === "") lines.pop();

              return lines.map((line, lineIndex) => {
                const isAdded = change.added === true;
                const isRemoved = change.removed === true;

                return (
                  <tr
                    key={`${changeIndex}-${lineIndex}`}
                    className={cn(
                      "group",
                      isAdded && "bg-sf-success/5",
                      isRemoved && "bg-sf-danger/5"
                    )}
                  >
                    {/* Gutter */}
                    <td
                      className={cn(
                        "select-none w-6 px-3 text-center border-r",
                        isAdded
                          ? "text-sf-success border-sf-success/20 bg-sf-success/10"
                          : isRemoved
                          ? "text-sf-danger border-sf-danger/20 bg-sf-danger/10"
                          : "text-sf-text-muted border-sf-border"
                      )}
                      aria-hidden="true"
                    >
                      {isAdded ? "+" : isRemoved ? "−" : " "}
                    </td>

                    {/* Line content */}
                    <td
                      className={cn(
                        "py-0.5 pl-3 pr-4 whitespace-pre",
                        isAdded
                          ? "text-sf-success"
                          : isRemoved
                          ? "text-sf-danger"
                          : "text-sf-text-secondary"
                      )}
                    >
                      {line || " "}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
