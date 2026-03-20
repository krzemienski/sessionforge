"use client";

import {
  CheckCircle2,
  XCircle,
  Send,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Clock,
  MessageSquare,
  Loader2,
  History,
  User,
} from "lucide-react";
import { useApprovalTimeline } from "@/hooks/use-approval";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  id: string;
  type: "decision" | "activity";
  action: string;
  userId: string | null;
  userName: string | null;
  userImage: string | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

interface ApprovalTimelineProps {
  postId: string;
  className?: string;
}

function getActionIcon(action: string) {
  switch (action) {
    case "review_approved":
    case "post_approved":
      return <CheckCircle2 size={14} className="text-sf-success flex-shrink-0" />;
    case "review_rejected":
      return <XCircle size={14} className="text-sf-danger flex-shrink-0" />;
    case "review_changes_requested":
      return <MessageSquare size={14} className="text-sf-warning flex-shrink-0" />;
    case "post_submitted_for_review":
    case "review_decision_submitted":
      return <Send size={14} className="text-sf-accent flex-shrink-0" />;
    case "reviewer_assigned":
      return <UserPlus size={14} className="text-sf-accent flex-shrink-0" />;
    case "reviewer_removed":
      return <UserMinus size={14} className="text-sf-text-muted flex-shrink-0" />;
    case "status_transition":
      return <ArrowRightLeft size={14} className="text-sf-text-secondary flex-shrink-0" />;
    default:
      return <Clock size={14} className="text-sf-text-muted flex-shrink-0" />;
  }
}

function getActionLabel(action: string, metadata: Record<string, unknown> | null): string {
  switch (action) {
    case "review_approved":
      return "Approved";
    case "review_rejected":
      return "Rejected";
    case "review_changes_requested":
      return "Requested changes";
    case "post_submitted_for_review":
      return "Submitted for review";
    case "review_decision_submitted":
      return "Decision submitted";
    case "post_approved":
      return "Post approved";
    case "reviewer_assigned":
      return "Reviewer assigned";
    case "reviewer_removed":
      return "Reviewer removed";
    case "status_transition": {
      const from = metadata?.fromStatus as string | undefined;
      const to = metadata?.toStatus as string | undefined;
      if (from && to) return `Status: ${from} \u2192 ${to}`;
      return "Status changed";
    }
    default:
      return action.replace(/_/g, " ");
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case "review_approved":
    case "post_approved":
      return "border-sf-success/30";
    case "review_rejected":
      return "border-sf-danger/30";
    case "review_changes_requested":
      return "border-sf-warning/30";
    case "post_submitted_for_review":
      return "border-sf-accent/30";
    default:
      return "border-sf-border";
  }
}

function UserAvatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || "User"}
        className="w-6 h-6 rounded-full flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-6 h-6 rounded-full bg-sf-bg-hover flex items-center justify-center flex-shrink-0">
      <User size={12} className="text-sf-text-muted" />
    </div>
  );
}

function TimelineEntryCard({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const isDecision = entry.type === "decision";
  const actionColor = getActionColor(entry.action);

  return (
    <div className="flex gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <UserAvatar name={entry.userName} image={entry.userImage} />
        {!isLast && <div className="w-px flex-1 bg-sf-border mt-1" />}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 pb-4 min-w-0",
        )}
      >
        <div
          className={cn(
            "rounded-sf p-2.5 transition-colors",
            isDecision
              ? `bg-sf-bg-secondary border ${actionColor}`
              : "bg-transparent"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {getActionIcon(entry.action)}
            <span className="text-sm text-sf-text-primary font-medium truncate">
              {getActionLabel(entry.action, entry.metadata)}
            </span>
          </div>

          {entry.userName && (
            <p className="text-xs text-sf-text-secondary mt-1">
              by {entry.userName}
            </p>
          )}

          {entry.comment && (
            <div className="mt-2 bg-sf-bg-primary border border-sf-border rounded-sf px-2 py-1.5 text-xs text-sf-text-secondary whitespace-pre-wrap">
              {entry.comment}
            </div>
          )}

          <p className="text-xs text-sf-text-muted mt-1.5">
            {entry.createdAt
              ? new Date(entry.createdAt).toLocaleString()
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ApprovalTimeline({ postId, className }: ApprovalTimelineProps) {
  const timeline = useApprovalTimeline(postId);

  const entries: TimelineEntry[] = timeline.data?.timeline ?? [];

  if (timeline.isLoading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="px-4 py-3 border-b border-sf-border">
          <h3 className="font-display font-semibold text-sf-text-primary text-sm">
            Approval Timeline
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

  if (timeline.isError) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="px-4 py-3 border-b border-sf-border">
          <h3 className="font-display font-semibold text-sf-text-primary text-sm">
            Approval Timeline
          </h3>
        </div>
        <div className="text-center py-12 px-4">
          <p className="text-sm text-sf-danger">
            Failed to load timeline.
          </p>
          <p className="text-xs text-sf-text-muted mt-1">
            Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-4 py-3 border-b border-sf-border">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">
          Approval Timeline
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <History size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-secondary">No activity yet.</p>
            <p className="text-xs text-sf-text-muted mt-1">
              Submit this post for review to begin the approval process.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry, index) => (
              <TimelineEntryCard
                key={entry.id}
                entry={entry}
                isLast={index === entries.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
