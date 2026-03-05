"use client";

import { useState } from "react";
import {
  Bot,
  User,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  X,
  History,
  Loader2,
} from "lucide-react";
import { useRevisions, useRevision, useRestoreRevision } from "@/hooks/use-revisions";
import { DiffViewer } from "./diff-viewer";
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
}

interface RevisionHistoryPanelProps {
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

function getEditTypeLabel(editType: string): string {
  switch (editType) {
    case "ai_generated":
      return "AI edit";
    case "auto_save":
      return "Auto-save";
    case "restore":
      return "Restored";
    default:
      return "Manual save";
  }
}

// --- Sub-components ---

interface RevisionCardProps {
  revision: RevisionEntry;
  onViewDiff: () => void;
  onRestore: () => void;
  isRestoring: boolean;
}

function MajorRevisionCard({ revision, onViewDiff, onRestore, isRestoring }: RevisionCardProps) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-3 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 px-2 py-0.5 bg-sf-accent text-white rounded-sf-full text-xs font-bold font-display">
            v{revision.versionNumber}
          </span>
          {getEditTypeIcon(revision.editType)}
          <span className="text-sm text-sf-text-primary truncate">
            {getEditTypeLabel(revision.editType)}
          </span>
        </div>
        {revision.wordCountDelta !== null && revision.wordCountDelta !== 0 && (
          <span
            className={cn(
              "text-xs font-mono flex-shrink-0",
              revision.wordCountDelta > 0 ? "text-sf-success" : "text-sf-danger"
            )}
          >
            {revision.wordCountDelta > 0 ? "+" : ""}
            {revision.wordCountDelta}w
          </span>
        )}
      </div>
      <p className="text-xs text-sf-text-muted mt-1.5">
        {revision.createdAt ? new Date(revision.createdAt).toLocaleString() : ""}
      </p>
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={onViewDiff}
          className="text-xs text-sf-accent hover:underline"
        >
          View diff
        </button>
        <button
          onClick={onRestore}
          disabled={isRestoring}
          className="flex items-center gap-1 text-xs text-sf-text-secondary hover:text-sf-text-primary transition-colors disabled:opacity-50"
        >
          <RotateCcw size={11} />
          Restore
        </button>
      </div>
    </div>
  );
}

function MinorRevisionRow({ revision, onViewDiff, onRestore, isRestoring }: RevisionCardProps) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-sf hover:bg-sf-bg-hover transition-colors group">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-sf-text-muted font-mono w-7 flex-shrink-0 text-right">
          v{revision.versionNumber}
        </span>
        {getEditTypeIcon(revision.editType)}
        <span className="text-xs text-sf-text-secondary truncate">
          {revision.createdAt ? new Date(revision.createdAt).toLocaleString() : ""}
        </span>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={onViewDiff}
          className="text-xs text-sf-accent hover:underline"
        >
          Diff
        </button>
        <button
          onClick={onRestore}
          disabled={isRestoring}
          title="Restore this version"
          className="text-sf-text-muted hover:text-sf-text-secondary transition-colors disabled:opacity-50"
        >
          <RotateCcw size={11} />
        </button>
      </div>
    </div>
  );
}

interface DiffOverlayProps {
  postId: string;
  revision: RevisionEntry;
  onClose: () => void;
}

function DiffOverlay({ postId, revision, onClose }: DiffOverlayProps) {
  const targetRev = useRevision(postId, revision.id);
  const parentRev = useRevision(postId, revision.parentRevisionId ?? "");

  const isLoading =
    targetRev.isLoading || (!!revision.parentRevisionId && parentRev.isLoading);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-sf-bg-primary/90 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl bg-sf-bg-secondary border border-sf-border rounded-sf-lg my-8 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-sf-border">
          <div>
            <h3 className="font-display font-semibold text-sf-text-primary text-sm">
              Changes in v{revision.versionNumber}
            </h3>
            <p className="text-xs text-sf-text-secondary mt-0.5">
              {getEditTypeLabel(revision.editType)}
              {revision.createdAt
                ? ` · ${new Date(revision.createdAt).toLocaleString()}`
                : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sf hover:bg-sf-bg-hover text-sf-text-muted hover:text-sf-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-sf-accent" />
            </div>
          ) : (
            <DiffViewer
              fromContent={parentRev.data?.markdown ?? ""}
              toContent={targetRev.data?.markdown ?? ""}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main component ---

export function RevisionHistoryPanel({ postId, className }: RevisionHistoryPanelProps) {
  const [expandedMinorGroups, setExpandedMinorGroups] = useState<Set<number>>(new Set());
  const [diffRevision, setDiffRevision] = useState<RevisionEntry | null>(null);

  const revisions = useRevisions(postId);
  const restore = useRestoreRevision(postId);

  const revisionList: RevisionEntry[] = revisions.data?.revisions ?? [];

  // Group revisions: traverse newest-first, accumulating minors under the major
  // that immediately follows them (i.e., the most recent major before any subsequent minors).
  // Minors appear "after" a major in the timeline, representing intermediate auto-saves.
  type Group = {
    major: RevisionEntry;
    minors: RevisionEntry[];
    groupIndex: number;
  };

  const groups: Group[] = [];
  const orphanMinors: RevisionEntry[] = [];
  let pendingMinors: RevisionEntry[] = [];
  let groupIndex = 0;

  for (const rev of revisionList) {
    if (rev.versionType === "major") {
      groups.push({
        major: rev,
        minors: pendingMinors,
        groupIndex: groupIndex++,
      });
      pendingMinors = [];
    } else {
      pendingMinors.push(rev);
    }
  }

  // Edge case: minor revisions with no following major (e.g., only auto-saves since creation)
  for (const minor of pendingMinors) {
    orphanMinors.push(minor);
  }

  function toggleMinorGroup(index: number) {
    setExpandedMinorGroups((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleRestore(revisionId: string) {
    restore.mutate(revisionId);
  }

  if (revisions.isLoading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="px-4 py-3 border-b border-sf-border">
          <h3 className="font-display font-semibold text-sf-text-primary text-sm">
            Version History
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-sf-bg-secondary rounded-sf-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-4 py-3 border-b border-sf-border">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">
          Version History
        </h3>
        {restore.isPending && (
          <p className="text-xs text-sf-accent mt-1 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" />
            Restoring version...
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {revisionList.length === 0 ? (
          <div className="text-center py-12">
            <History size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-secondary">No history yet.</p>
            <p className="text-xs text-sf-text-muted mt-1">
              Save your content to create a version.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Orphan minors: most recent auto-saves before any major save */}
            {orphanMinors.length > 0 && (
              <div className="space-y-0.5">
                {orphanMinors.map((rev) => (
                  <MinorRevisionRow
                    key={rev.id}
                    revision={rev}
                    onViewDiff={() => setDiffRevision(rev)}
                    onRestore={() => handleRestore(rev.id)}
                    isRestoring={restore.isPending}
                  />
                ))}
              </div>
            )}

            {/* Grouped major versions with collapsed minor revisions */}
            {groups.map((group) => (
              <div key={group.major.id} className="space-y-1">
                <MajorRevisionCard
                  revision={group.major}
                  onViewDiff={() => setDiffRevision(group.major)}
                  onRestore={() => handleRestore(group.major.id)}
                  isRestoring={restore.isPending}
                />

                {group.minors.length > 0 && (
                  <div className="ml-3">
                    <button
                      onClick={() => toggleMinorGroup(group.groupIndex)}
                      className="flex items-center gap-1.5 text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors py-0.5 px-1"
                    >
                      {expandedMinorGroups.has(group.groupIndex) ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                      <Clock size={11} />
                      <span>
                        {group.minors.length} auto-save
                        {group.minors.length !== 1 ? "s" : ""}
                      </span>
                    </button>

                    {expandedMinorGroups.has(group.groupIndex) && (
                      <div className="border-l-2 border-sf-border ml-2 pl-2 space-y-0.5 mt-0.5">
                        {group.minors.map((rev) => (
                          <MinorRevisionRow
                            key={rev.id}
                            revision={rev}
                            onViewDiff={() => setDiffRevision(rev)}
                            onRestore={() => handleRestore(rev.id)}
                            isRestoring={restore.isPending}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {diffRevision && (
        <DiffOverlay
          postId={postId}
          revision={diffRevision}
          onClose={() => setDiffRevision(null)}
        />
      )}
    </div>
  );
}
