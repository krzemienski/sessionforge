"use client";

import { useState } from "react";
import {
  Bot,
  User,
  Clock,
  RotateCcw,
  Loader2,
  AlignLeft,
  Columns2,
  GitCompare,
} from "lucide-react";
import {
  useRevisions,
  useRevision,
  useRevisionDiff,
  useRestoreRevision,
} from "@/hooks/use-revisions";
import { DiffViewer } from "./diff-viewer";
import { SideBySideDiffViewer } from "./side-by-side-diff-viewer";
import { cn } from "@/lib/utils";

interface RevisionEntry {
  id: string;
  postId: string;
  versionNumber: number;
  versionType: "major" | "minor";
  editType: "user_edit" | "ai_generated" | "auto_save" | "restore";
  parentRevisionId: string | null;
  title: string | null;
  wordCount: number | null;
  wordCountDelta: number | null;
  createdAt: string | null;
  createdBy: string | null;
  versionLabel: string | null;
  versionNotes: string | null;
}

interface RevisionCompareBarProps {
  postId: string;
  className?: string;
}

function getEditTypeIcon(editType: string) {
  switch (editType) {
    case "ai_generated":
      return <Bot size={14} className="text-sf-accent flex-shrink-0" />;
    case "auto_save":
      return <Clock size={14} className="text-sf-text-muted flex-shrink-0" />;
    case "restore":
      return <RotateCcw size={14} className="text-sf-success flex-shrink-0" />;
    default:
      return <User size={14} className="text-sf-text-secondary flex-shrink-0" />;
  }
}

function formatOptionLabel(rev: RevisionEntry): string {
  const version = rev.versionLabel ? `${rev.versionLabel} (v${rev.versionNumber})` : `v${rev.versionNumber}`;
  const editSuffix = rev.editType === "ai_generated" ? " · AI" : "";
  const time = rev.createdAt
    ? ` · ${new Date(rev.createdAt).toLocaleString()}`
    : "";
  return `${version}${editSuffix}${time}`;
}

export function RevisionCompareBar({ postId, className }: RevisionCompareBarProps) {
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<"unified" | "split">("unified");

  const revisions = useRevisions(postId);
  const fromRevision = useRevision(postId, fromId ?? "");
  const toRevision = useRevision(postId, toId ?? "");
  // useRevisionDiff fetches precomputed diff metadata (used for isError/error state)
  const diffQuery = useRevisionDiff(postId, fromId, toId);
  const restore = useRestoreRevision(postId);

  const revisionList: RevisionEntry[] = revisions.data?.revisions ?? [];
  const bothSelected = !!fromId && !!toId;
  const isLoadingContent =
    bothSelected && (fromRevision.isLoading || toRevision.isLoading);

  function handleRestore() {
    if (toId) {
      restore.mutate(toId);
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Controls bar */}
      <div className="flex flex-wrap items-end gap-3 bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-3">
        {/* From selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-sf-text-muted font-medium">
            Compare from
          </label>
          <select
            value={fromId ?? ""}
            onChange={(e) => setFromId(e.target.value || null)}
            className="bg-sf-bg-primary border border-sf-border rounded-sf px-2 py-1.5 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus min-w-[220px]"
          >
            <option value="">Select revision…</option>
            {revisionList.map((rev) => (
              <option key={rev.id} value={rev.id}>
                {formatOptionLabel(rev)}
              </option>
            ))}
          </select>
        </div>

        <span className="text-sf-text-muted pb-2">→</span>

        {/* To selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-sf-text-muted font-medium">
            Compare to
          </label>
          <select
            value={toId ?? ""}
            onChange={(e) => setToId(e.target.value || null)}
            className="bg-sf-bg-primary border border-sf-border rounded-sf px-2 py-1.5 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus min-w-[220px]"
          >
            <option value="">Select revision…</option>
            {revisionList.map((rev) => (
              <option key={rev.id} value={rev.id}>
                {formatOptionLabel(rev)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Diff mode toggle */}
          <div className="flex items-center gap-1 bg-sf-bg-primary rounded-sf p-0.5 border border-sf-border">
            <button
              onClick={() => setDiffMode("unified")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-sf text-xs transition-colors",
                diffMode === "unified"
                  ? "bg-sf-accent text-white"
                  : "text-sf-text-muted hover:text-sf-text-secondary"
              )}
              title="Unified diff view"
            >
              <AlignLeft size={14} />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setDiffMode("split")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-sf text-xs transition-colors",
                diffMode === "split"
                  ? "bg-sf-accent text-white"
                  : "text-sf-text-muted hover:text-sf-text-secondary"
              )}
              title="Side-by-side diff view"
            >
              <Columns2 size={14} />
              <span>Split</span>
            </button>
          </div>

          {/* Restore "to" revision button */}
          {toId && (
            <button
              onClick={handleRestore}
              disabled={restore.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sf-bg-primary border border-sf-border rounded-sf text-sf-text-secondary hover:text-sf-text-primary hover:border-sf-border-focus transition-colors disabled:opacity-50"
              title="Restore the 'Compare to' revision"
            >
              {restore.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RotateCcw size={12} />
              )}
              Restore this version
            </button>
          )}
        </div>
      </div>

      {/* Restore success message */}
      {restore.isSuccess && (
        <p className="text-xs text-sf-success flex items-center gap-1.5">
          <RotateCcw size={12} />
          Version restored successfully.
        </p>
      )}

      {/* Empty state */}
      {!bothSelected && (
        <div className="flex flex-col items-center justify-center py-16 text-sf-text-muted">
          <GitCompare size={32} className="mb-3 opacity-40" />
          <p className="text-sm">
            Select two revisions above to compare their differences.
          </p>
        </div>
      )}

      {/* Loading state */}
      {bothSelected && isLoadingContent && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-sf-accent" />
        </div>
      )}

      {/* Error state */}
      {bothSelected && !isLoadingContent && diffQuery.isError && (
        <div className="flex items-center justify-center py-8 text-sf-danger text-sm">
          Failed to load diff. Please try again.
        </div>
      )}

      {/* Diff content */}
      {bothSelected && !isLoadingContent && !diffQuery.isError && (
        <div>
          {/* Revision info header */}
          <div className="flex items-center gap-3 mb-3 px-1 text-xs text-sf-text-secondary">
            {fromRevision.data && (
              <div className="flex items-center gap-1.5">
                {getEditTypeIcon(fromRevision.data.editType)}
                <span>
                  {fromRevision.data.versionLabel
                    ? fromRevision.data.versionLabel
                    : `v${fromRevision.data.versionNumber}`}
                </span>
                {fromRevision.data.createdAt && (
                  <span className="text-sf-text-muted">
                    · {new Date(fromRevision.data.createdAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            <span className="text-sf-text-muted">→</span>

            {toRevision.data && (
              <div className="flex items-center gap-1.5">
                {getEditTypeIcon(toRevision.data.editType)}
                <span>
                  {toRevision.data.versionLabel
                    ? toRevision.data.versionLabel
                    : `v${toRevision.data.versionNumber}`}
                </span>
                {toRevision.data.createdAt && (
                  <span className="text-sf-text-muted">
                    · {new Date(toRevision.data.createdAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Diff viewer */}
          {diffMode === "unified" ? (
            <DiffViewer
              fromContent={fromRevision.data?.markdown ?? ""}
              toContent={toRevision.data?.markdown ?? ""}
            />
          ) : (
            <SideBySideDiffViewer
              fromContent={fromRevision.data?.markdown ?? ""}
              toContent={toRevision.data?.markdown ?? ""}
            />
          )}
        </div>
      )}
    </div>
  );
}
