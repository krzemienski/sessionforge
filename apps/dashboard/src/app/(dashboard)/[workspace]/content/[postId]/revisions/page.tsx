"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  User,
  Clock,
  RotateCcw,
  History,
  Loader2,
} from "lucide-react";
import { useRevisions } from "@/hooks/use-revisions";
import { usePost } from "@/hooks/use-content";
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

function getEditTypeIcon(editType: string) {
  switch (editType) {
    case "ai_generated":
      return <Bot size={16} className="text-sf-accent flex-shrink-0" />;
    case "auto_save":
      return <Clock size={16} className="text-sf-text-muted flex-shrink-0" />;
    case "restore":
      return <RotateCcw size={16} className="text-sf-success flex-shrink-0" />;
    default:
      return <User size={16} className="text-sf-text-secondary flex-shrink-0" />;
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

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface RevisionRowProps {
  revision: RevisionEntry;
  workspace: string;
  postId: string;
}

function RevisionRow({ revision, workspace, postId }: RevisionRowProps) {
  const isMajor = revision.versionType === "major";
  const diffParams = new URLSearchParams();
  if (revision.parentRevisionId) diffParams.set("from", revision.parentRevisionId);
  diffParams.set("to", revision.id);
  const diffHref = `/${workspace}/content/${postId}/revisions?${diffParams.toString()}`;

  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-sf-lg border transition-colors",
        isMajor
          ? "bg-sf-bg-secondary border-sf-border hover:border-sf-border-focus"
          : "bg-sf-bg-primary border-sf-border/50 hover:border-sf-border ml-6"
      )}
    >
      {/* Version badge */}
      <div className="flex-shrink-0 pt-0.5">
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-sf-full font-display font-bold",
            isMajor
              ? "bg-sf-accent text-white px-2.5 py-0.5 text-sm min-w-[2.5rem]"
              : "bg-sf-bg-hover text-sf-text-secondary px-2 py-0.5 text-xs min-w-[2rem]"
          )}
        >
          {revision.versionLabel || `v${revision.versionNumber}`}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit type icon + label */}
          {getEditTypeIcon(revision.editType)}
          <span
            className={cn(
              "font-medium",
              isMajor ? "text-sm text-sf-text-primary" : "text-xs text-sf-text-secondary"
            )}
          >
            {getEditTypeLabel(revision.editType)}
          </span>

          {/* Word count delta */}
          {revision.wordCountDelta !== null && revision.wordCountDelta !== 0 && (
            <span
              className={cn(
                "text-xs font-mono px-1.5 py-0.5 rounded-sf border flex-shrink-0",
                revision.wordCountDelta > 0
                  ? "text-sf-success bg-sf-success/10 border-sf-success/20"
                  : "text-sf-danger bg-sf-danger/10 border-sf-danger/20"
              )}
            >
              {revision.wordCountDelta > 0 ? "+" : ""}
              {revision.wordCountDelta}w
            </span>
          )}

          {/* Word count */}
          {revision.wordCount !== null && (
            <span className="text-xs text-sf-text-muted">
              {revision.wordCount.toLocaleString()} words
            </span>
          )}
        </div>

        {/* Author + timestamp */}
        <div className="flex items-center gap-2 mt-1">
          {revision.createdBy && (
            <span className="text-xs text-sf-text-muted truncate max-w-[10rem]">
              {revision.createdBy}
            </span>
          )}
          {revision.createdBy && revision.createdAt && (
            <span className="text-xs text-sf-text-muted">·</span>
          )}
          {revision.createdAt && (
            <span
              className="text-xs text-sf-text-muted"
              title={new Date(revision.createdAt).toLocaleString()}
            >
              {formatRelativeTime(revision.createdAt)}
            </span>
          )}
        </div>
      </div>

      {/* View diff action */}
      <div className="flex-shrink-0 pt-0.5">
        <Link
          href={diffHref}
          className={cn(
            "text-xs text-sf-accent hover:underline transition-colors",
            !revision.parentRevisionId && "opacity-50 pointer-events-none"
          )}
          aria-disabled={!revision.parentRevisionId}
        >
          View diff
        </Link>
      </div>
    </div>
  );
}

export default function RevisionsPage() {
  const { workspace, postId } = useParams<{ workspace: string; postId: string }>();
  const router = useRouter();
  const post = usePost(postId);
  const revisions = useRevisions(postId);

  const revisionList: RevisionEntry[] = revisions.data?.revisions ?? [];

  return (
    <div className="min-h-screen bg-sf-bg-primary">
      {/* Header */}
      <div className="border-b border-sf-border bg-sf-bg-secondary sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/${workspace}/content/${postId}`)}
            className="p-1.5 rounded-sf hover:bg-sf-bg-hover text-sf-text-muted hover:text-sf-text-primary transition-colors flex-shrink-0"
            title="Back to editor"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-display font-semibold text-sf-text-primary text-base truncate">
              {post.isLoading
                ? "Loading…"
                : post.data?.title || "Untitled Post"}
            </h1>
            <p className="text-xs text-sf-text-muted mt-0.5">Version History</p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-sf-text-muted flex-shrink-0">
            <History size={14} />
            <span>{revisionList.length} revision{revisionList.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {revisions.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-sf-bg-secondary rounded-sf-lg" />
              </div>
            ))}
          </div>
        ) : revisions.isError ? (
          <div className="text-center py-16">
            <p className="text-sm text-sf-danger">Failed to load revision history.</p>
            <button
              onClick={() => revisions.refetch()}
              className="mt-3 text-xs text-sf-accent hover:underline"
            >
              Try again
            </button>
          </div>
        ) : revisionList.length === 0 ? (
          <div className="text-center py-16">
            <History size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sm text-sf-text-secondary">No revision history yet.</p>
            <p className="text-xs text-sf-text-muted mt-1">
              Save your content to start tracking versions.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {revisionList.map((revision) => (
              <RevisionRow
                key={revision.id}
                revision={revision}
                workspace={workspace}
                postId={postId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
