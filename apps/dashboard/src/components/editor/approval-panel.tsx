"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { ReviewerAssignment } from "@/components/approval/reviewer-assignment";
import { ApprovalTimeline } from "@/components/approval/approval-timeline";
import {
  useReviewStatus,
  useSubmitForReview,
  useSubmitDecision,
  useApprovalSettings,
} from "@/hooks/use-approval";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface WorkspaceMember {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface ApprovalPanelProps {
  postId: string;
  postStatus: string;
  workspace: string;
  members?: WorkspaceMember[];
  canManage?: boolean;
  isReviewer?: boolean;
  className?: string;
}

type DecisionType = "approved" | "rejected" | "changes_requested";

// ── Publish gating banner ──────────────────────────────────────────────────

function PublishGatingStatus({
  postStatus,
  isApproved,
  approvedCount,
  requiredApprovers,
  workflowEnabled,
}: {
  postStatus: string;
  isApproved: boolean;
  approvedCount: number;
  requiredApprovers: number;
  workflowEnabled: boolean;
}) {
  if (!workflowEnabled) {
    return (
      <div className="flex items-center gap-2.5 p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
        <ShieldQuestion size={18} className="text-sf-text-muted flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-sf-text-secondary">
            Approval workflow disabled
          </p>
          <p className="text-xs text-sf-text-muted mt-0.5">
            Enable in workspace settings to require approvals before publishing.
          </p>
        </div>
      </div>
    );
  }

  if (postStatus === "published") {
    return (
      <div className="flex items-center gap-2.5 p-3 bg-sf-success/10 border border-sf-success/20 rounded-sf">
        <ShieldCheck size={18} className="text-sf-success flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-sf-success">Published</p>
          <p className="text-xs text-sf-text-muted mt-0.5">
            This post has been approved and published.
          </p>
        </div>
      </div>
    );
  }

  if (isApproved || postStatus === "approved") {
    return (
      <div className="flex items-center gap-2.5 p-3 bg-sf-success/10 border border-sf-success/20 rounded-sf">
        <ShieldCheck size={18} className="text-sf-success flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-sf-success">Ready to publish</p>
          <p className="text-xs text-sf-text-muted mt-0.5">
            All required approvals received ({approvedCount}/{requiredApprovers}).
          </p>
        </div>
      </div>
    );
  }

  if (postStatus === "in_review") {
    return (
      <div className="flex items-center gap-2.5 p-3 bg-sf-warning/10 border border-sf-warning/20 rounded-sf">
        <ShieldAlert size={18} className="text-sf-warning flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-sf-warning">Awaiting approval</p>
          <p className="text-xs text-sf-text-muted mt-0.5">
            {approvedCount} of {requiredApprovers} required approval{requiredApprovers !== 1 ? "s" : ""}.
            Publishing is blocked until approved.
          </p>
        </div>
      </div>
    );
  }

  // draft or other status
  return (
    <div className="flex items-center gap-2.5 p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
      <ShieldQuestion size={18} className="text-sf-text-muted flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-sf-text-secondary">Not submitted</p>
        <p className="text-xs text-sf-text-muted mt-0.5">
          Submit for review to start the approval process.
        </p>
      </div>
    </div>
  );
}

// ── Decision form ──────────────────────────────────────────────────────────

function DecisionForm({
  postId,
  isReviewer,
  postStatus,
}: {
  postId: string;
  isReviewer: boolean;
  postStatus: string;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submitDecision = useSubmitDecision();

  const canDecide = isReviewer && postStatus === "in_review";

  const handleSubmit = (decision: DecisionType) => {
    setError(null);
    submitDecision.mutate(
      { postId, decision, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setComment("");
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to submit decision");
        },
      }
    );
  };

  if (!canDecide) {
    if (postStatus !== "in_review") return null;

    return (
      <div className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
        <p className="text-xs text-sf-text-muted text-center">
          Only assigned reviewers can submit decisions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold font-display text-sf-text-primary">
        Submit Decision
      </h3>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional)..."
        rows={3}
        disabled={submitDecision.isPending}
        className="w-full bg-sf-bg-secondary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus resize-none disabled:opacity-50"
      />

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-sf-danger">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleSubmit("approved")}
          disabled={submitDecision.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sf-success/15 text-sf-success border border-sf-success/20 rounded-sf text-sm font-medium hover:bg-sf-success/25 transition-colors disabled:opacity-50"
        >
          {submitDecision.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          Approve
        </button>

        <button
          onClick={() => handleSubmit("changes_requested")}
          disabled={submitDecision.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sf-warning/15 text-sf-warning border border-sf-warning/20 rounded-sf text-sm font-medium hover:bg-sf-warning/25 transition-colors disabled:opacity-50"
        >
          {submitDecision.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <MessageSquare size={14} />
          )}
          Changes
        </button>

        <button
          onClick={() => handleSubmit("rejected")}
          disabled={submitDecision.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sf-danger/15 text-sf-danger border border-sf-danger/20 rounded-sf text-sm font-medium hover:bg-sf-danger/25 transition-colors disabled:opacity-50"
        >
          {submitDecision.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <XCircle size={14} />
          )}
          Reject
        </button>
      </div>
    </div>
  );
}

// ── Submit for review button ───────────────────────────────────────────────

function SubmitForReviewButton({
  postId,
  postStatus,
  canManage,
}: {
  postId: string;
  postStatus: string;
  canManage: boolean;
}) {
  const submitForReview = useSubmitForReview();
  const [error, setError] = useState<string | null>(null);

  if (postStatus !== "draft" || !canManage) return null;

  const handleSubmit = () => {
    setError(null);
    submitForReview.mutate(
      { postId },
      {
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to submit for review");
        },
      }
    );
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleSubmit}
        disabled={submitForReview.isPending}
        className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 bg-sf-accent text-white rounded-sf text-sm font-medium hover:bg-sf-accent/90 transition-colors disabled:opacity-50"
      >
        {submitForReview.isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Send size={14} />
        )}
        Submit for Review
      </button>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-sf-danger">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ApprovalPanel({
  postId,
  postStatus,
  workspace,
  members = [],
  canManage = false,
  isReviewer = false,
  className,
}: ApprovalPanelProps) {
  const reviewStatus = useReviewStatus(postId);
  const approvalSettings = useApprovalSettings(workspace);

  const workflowEnabled = approvalSettings.data?.enabled ?? false;
  const approvalProgress = reviewStatus.data?.approvalProgress ?? {
    approvedCount: 0,
    requiredApprovers: 1,
    isApproved: false,
  };

  if (reviewStatus.isLoading || approvalSettings.isLoading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="px-4 py-3 border-b border-sf-border">
          <h3 className="font-display font-semibold text-sf-text-primary text-sm">
            Review
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-border">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">
          Review
        </h3>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
        {/* Publish gating status */}
        <PublishGatingStatus
          postStatus={postStatus}
          isApproved={approvalProgress.isApproved}
          approvedCount={approvalProgress.approvedCount}
          requiredApprovers={approvalProgress.requiredApprovers}
          workflowEnabled={workflowEnabled}
        />

        {/* Submit for review action */}
        {workflowEnabled && (
          <SubmitForReviewButton
            postId={postId}
            postStatus={postStatus}
            canManage={canManage}
          />
        )}

        {/* Reviewer assignment */}
        {workflowEnabled && (
          <ReviewerAssignment
            postId={postId}
            workspace={workspace}
            members={members}
            canManage={canManage}
          />
        )}

        {/* Decision form */}
        {workflowEnabled && (
          <DecisionForm
            postId={postId}
            isReviewer={isReviewer}
            postStatus={postStatus}
          />
        )}

        {/* Divider before timeline */}
        {workflowEnabled && (
          <div className="border-t border-sf-border" />
        )}

        {/* Approval timeline */}
        {workflowEnabled && (
          <ApprovalTimeline postId={postId} />
        )}
      </div>
    </div>
  );
}
