"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  UserMinus,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  Users,
  ChevronDown,
  Loader2,
  User,
} from "lucide-react";
import { useReviewStatus, useAssignReviewers, useRemoveReviewer } from "@/hooks/use-approval";
import { cn } from "@/lib/utils";

interface Reviewer {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  decision: "approved" | "rejected" | "changes_requested" | null;
  decisionComment: string | null;
  decisionAt: string | null;
}

interface WorkspaceMember {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface ReviewerAssignmentProps {
  postId: string;
  workspace: string;
  members?: WorkspaceMember[];
  canManage?: boolean;
  className?: string;
}

function getDecisionIcon(decision: string | null) {
  switch (decision) {
    case "approved":
      return <CheckCircle2 size={14} className="text-sf-success flex-shrink-0" />;
    case "rejected":
      return <XCircle size={14} className="text-sf-danger flex-shrink-0" />;
    case "changes_requested":
      return <MessageSquare size={14} className="text-sf-warning flex-shrink-0" />;
    default:
      return <Clock size={14} className="text-sf-text-muted flex-shrink-0" />;
  }
}

function getDecisionLabel(decision: string | null): string {
  switch (decision) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "changes_requested":
      return "Changes requested";
    default:
      return "Pending";
  }
}

function getDecisionColor(decision: string | null): string {
  switch (decision) {
    case "approved":
      return "text-sf-success";
    case "rejected":
      return "text-sf-danger";
    case "changes_requested":
      return "text-sf-warning";
    default:
      return "text-sf-text-muted";
  }
}

function ReviewerAvatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || "Reviewer"}
        className="w-7 h-7 rounded-full flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-7 h-7 rounded-full bg-sf-bg-hover flex items-center justify-center flex-shrink-0">
      <User size={13} className="text-sf-text-muted" />
    </div>
  );
}

function ReviewerCard({
  reviewer,
  canManage,
  onRemove,
  isRemoving,
}: {
  reviewer: Reviewer;
  canManage: boolean;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 bg-sf-bg-tertiary border border-sf-border rounded-sf group">
      <ReviewerAvatar name={reviewer.userName} image={reviewer.userImage} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-sf-text-primary font-medium truncate">
            {reviewer.userName || reviewer.userEmail || "Unknown user"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {getDecisionIcon(reviewer.decision)}
          <span className={cn("text-xs", getDecisionColor(reviewer.decision))}>
            {getDecisionLabel(reviewer.decision)}
          </span>
          {reviewer.decisionAt && (
            <span className="text-xs text-sf-text-muted">
              &middot; {new Date(reviewer.decisionAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {canManage && (
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="p-1.5 text-sf-text-muted hover:text-sf-danger transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
          title="Remove reviewer"
        >
          {isRemoving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UserMinus size={14} />
          )}
        </button>
      )}
    </div>
  );
}

export function ReviewerAssignment({
  postId,
  workspace,
  members = [],
  canManage = false,
  className,
}: ReviewerAssignmentProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const reviewStatus = useReviewStatus(postId);
  const assignReviewers = useAssignReviewers();
  const removeReviewer = useRemoveReviewer();

  const reviewers: Reviewer[] = reviewStatus.data?.reviewers ?? [];
  const approvalProgress = reviewStatus.data?.approvalProgress ?? {
    approvedCount: 0,
    requiredApprovers: 1,
    isApproved: false,
  };

  const assignedUserIds = new Set(reviewers.map((r) => r.userId));
  const availableMembers = members.filter((m) => !assignedUserIds.has(m.id));

  const handleAssign = (memberId: string) => {
    assignReviewers.mutate(
      { postId, reviewerIds: [memberId] },
      {
        onSuccess: () => {
          setShowDropdown(false);
        },
      }
    );
  };

  const handleRemove = (reviewerId: string) => {
    setRemovingId(reviewerId);
    removeReviewer.mutate(
      { postId, reviewerId },
      {
        onSettled: () => {
          setRemovingId(null);
        },
      }
    );
  };

  if (reviewStatus.isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="animate-pulse space-y-2">
          <div className="h-5 bg-sf-bg-tertiary rounded w-1/3" />
          <div className="h-12 bg-sf-bg-tertiary rounded-sf" />
          <div className="h-12 bg-sf-bg-tertiary rounded-sf" />
        </div>
      </div>
    );
  }

  if (reviewStatus.isError) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-sf-accent" />
          <h3 className="text-sm font-semibold font-display text-sf-text-primary">Reviewers</h3>
        </div>
        <p className="text-xs text-sf-danger">Failed to load reviewer data.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-sf-accent" />
          <h3 className="text-sm font-semibold font-display text-sf-text-primary">Reviewers</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              approvalProgress.isApproved
                ? "bg-sf-success/10 text-sf-success"
                : "bg-sf-bg-tertiary text-sf-text-secondary"
            )}
          >
            {approvalProgress.approvedCount} of {approvalProgress.requiredApprovers} required
          </span>
        </div>
      </div>

      {/* Reviewer list */}
      {reviewers.length > 0 ? (
        <div className="space-y-1.5">
          {reviewers.map((reviewer) => (
            <ReviewerCard
              key={reviewer.id}
              reviewer={reviewer}
              canManage={canManage}
              onRemove={() => handleRemove(reviewer.userId)}
              isRemoving={removingId === reviewer.userId}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-sf-bg-secondary border border-sf-border rounded-sf">
          <Users size={24} className="mx-auto text-sf-text-muted mb-1.5" />
          <p className="text-xs text-sf-text-muted">No reviewers assigned</p>
          {canManage && (
            <p className="text-xs text-sf-text-muted mt-0.5">
              Add reviewers to begin the approval process.
            </p>
          )}
        </div>
      )}

      {/* Add reviewer dropdown */}
      {canManage && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={availableMembers.length === 0 && !showDropdown}
            className="flex items-center gap-1.5 w-full px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sm text-sf-text-secondary hover:bg-sf-bg-hover hover:border-sf-border-focus transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {assignReviewers.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserPlus size={14} />
            )}
            <span className="flex-1 text-left">
              {availableMembers.length === 0
                ? "All members assigned"
                : "Add reviewer"}
            </span>
            {availableMembers.length > 0 && (
              <ChevronDown
                size={14}
                className={cn(
                  "transition-transform",
                  showDropdown && "rotate-180"
                )}
              />
            )}
          </button>

          {showDropdown && availableMembers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-sf-bg-secondary border border-sf-border rounded-sf shadow-lg overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                {availableMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleAssign(member.id)}
                    disabled={assignReviewers.isPending}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
                  >
                    <ReviewerAvatar name={member.name} image={member.image} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-sf-text-primary truncate">
                        {member.name || "Unnamed"}
                      </p>
                      {member.email && (
                        <p className="text-xs text-sf-text-muted truncate">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
