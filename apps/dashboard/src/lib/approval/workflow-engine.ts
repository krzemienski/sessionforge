import { db } from "@/lib/db";
import {
  approvalWorkflows,
  approvalDecisions,
  postReviewers,
  posts,
} from "@sessionforge/db";
import { eq, and, count } from "drizzle-orm";
import type { postStatusEnum } from "@sessionforge/db";

type PostStatus = (typeof postStatusEnum.enumValues)[number];

/**
 * Valid status transitions for the editorial workflow.
 *
 * When approval workflow is disabled, direct transitions to "published" are allowed.
 * When enabled, content must pass through "in_review" → "approved" before publishing.
 */
const STATUS_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  idea: ["draft", "archived"],
  draft: ["in_review", "archived"],
  in_review: ["draft", "approved", "archived"],
  approved: ["published", "draft", "archived"],
  published: ["archived", "draft"],
  archived: ["draft"],
  scheduled: ["draft", "published", "archived"],
};

/**
 * Transitions allowed when approval workflow is disabled.
 * Permits direct draft → published without requiring review.
 */
const STATUS_TRANSITIONS_NO_WORKFLOW: Record<PostStatus, PostStatus[]> = {
  idea: ["draft", "published", "archived"],
  draft: ["published", "in_review", "archived"],
  in_review: ["draft", "approved", "published", "archived"],
  approved: ["published", "draft", "archived"],
  published: ["archived", "draft"],
  archived: ["draft"],
  scheduled: ["draft", "published", "archived"],
};

export interface WorkflowSettings {
  enabled: boolean;
  requiredApprovers: number;
  workflowId: string | null;
}

export interface ApprovalStatus {
  isApproved: boolean;
  approvalCount: number;
  requiredApprovers: number;
  pendingReviewers: number;
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_transition"
      | "approval_required"
      | "not_reviewer"
      | "workflow_not_enabled"
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

/**
 * Fetch approval workflow settings for a workspace.
 *
 * Returns the workflow configuration including whether approval is enabled
 * and how many approvers are required. If no workflow record exists,
 * returns defaults (disabled, 1 required approver).
 */
export async function getWorkflowSettings(
  workspaceId: string
): Promise<WorkflowSettings> {
  const workflow = await db.query.approvalWorkflows.findFirst({
    where: eq(approvalWorkflows.workspaceId, workspaceId),
  });

  if (!workflow) {
    return {
      enabled: false,
      requiredApprovers: 1,
      workflowId: null,
    };
  }

  return {
    enabled: workflow.enabled ?? false,
    requiredApprovers: workflow.requiredApprovers ?? 1,
    workflowId: workflow.id,
  };
}

/**
 * Check whether a status transition is valid given the current workflow settings.
 *
 * When approval workflow is enabled, enforces the full editorial pipeline:
 *   draft → in_review → approved → published
 *
 * When disabled, allows direct transitions (e.g., draft → published).
 *
 * @returns true if the transition is allowed, false otherwise
 */
export function canTransitionStatus(
  currentStatus: PostStatus,
  targetStatus: PostStatus,
  workflowEnabled: boolean
): boolean {
  if (currentStatus === targetStatus) {
    return true;
  }

  const transitions = workflowEnabled
    ? STATUS_TRANSITIONS
    : STATUS_TRANSITIONS_NO_WORKFLOW;

  const allowed = transitions[currentStatus];
  if (!allowed) {
    return false;
  }

  return allowed.includes(targetStatus);
}

/**
 * Check if a post has sufficient approvals to be published.
 *
 * Queries approval decisions for the post and compares the count of
 * "approved" decisions against the workspace's required approver threshold.
 */
export async function isApprovedForPublish(
  postId: string,
  workspaceId: string
): Promise<ApprovalStatus> {
  const settings = await getWorkflowSettings(workspaceId);

  if (!settings.enabled) {
    return {
      isApproved: true,
      approvalCount: 0,
      requiredApprovers: 0,
      pendingReviewers: 0,
    };
  }

  // Count approved decisions for this post
  const [approvalResult] = await db
    .select({ count: count() })
    .from(approvalDecisions)
    .where(
      and(
        eq(approvalDecisions.postId, postId),
        eq(approvalDecisions.decision, "approved")
      )
    );

  // Count total assigned reviewers
  const [reviewerResult] = await db
    .select({ count: count() })
    .from(postReviewers)
    .where(eq(postReviewers.postId, postId));

  const approvalCount = approvalResult?.count ?? 0;
  const totalReviewers = reviewerResult?.count ?? 0;
  const pendingReviewers = totalReviewers - approvalCount;

  return {
    isApproved: approvalCount >= settings.requiredApprovers,
    approvalCount,
    requiredApprovers: settings.requiredApprovers,
    pendingReviewers: Math.max(0, pendingReviewers),
  };
}

/**
 * Check if a user is an assigned reviewer for a given post.
 */
export async function isAssignedReviewer(
  postId: string,
  userId: string
): Promise<boolean> {
  const reviewer = await db.query.postReviewers.findFirst({
    where: and(
      eq(postReviewers.postId, postId),
      eq(postReviewers.userId, userId)
    ),
  });

  return !!reviewer;
}

/**
 * Validate a status transition and enforce workflow rules.
 *
 * This is the main entry point for status change validation. It checks:
 * 1. Whether the transition is structurally valid
 * 2. Whether approval requirements are met for publishing
 * 3. Whether the user has permission to approve (if transitioning to approved)
 *
 * @throws WorkflowError if the transition is not allowed
 */
export async function validateStatusTransition(
  postId: string,
  workspaceId: string,
  currentStatus: PostStatus,
  targetStatus: PostStatus,
  userId: string
): Promise<void> {
  const settings = await getWorkflowSettings(workspaceId);

  // Check structural validity
  if (!canTransitionStatus(currentStatus, targetStatus, settings.enabled)) {
    throw new WorkflowError(
      `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
      "invalid_transition"
    );
  }

  if (!settings.enabled) {
    return;
  }

  // When transitioning to "approved", verify user is an assigned reviewer
  if (targetStatus === "approved") {
    const isReviewer = await isAssignedReviewer(postId, userId);
    if (!isReviewer) {
      throw new WorkflowError(
        "Only assigned reviewers can approve content",
        "not_reviewer"
      );
    }
  }

  // When transitioning to "published", verify approval requirements are met
  if (targetStatus === "published") {
    const approvalStatus = await isApprovedForPublish(postId, workspaceId);
    if (!approvalStatus.isApproved) {
      throw new WorkflowError(
        `Post requires ${approvalStatus.requiredApprovers} approval(s) but has ${approvalStatus.approvalCount}. ` +
          `${approvalStatus.pendingReviewers} reviewer(s) have not yet approved.`,
        "approval_required"
      );
    }
  }
}
