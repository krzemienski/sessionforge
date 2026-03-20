import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  posts,
  postReviewers,
  approvalDecisions,
  workspaceActivity,
} from "@sessionforge/db";
import { eq } from "drizzle-orm";
import {
  getWorkflowSettings,
  canTransitionStatus,
  WorkflowError,
} from "@/lib/approval/workflow-engine";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/content/[id]/review
 *
 * Returns review status for a post: workflow settings, assigned reviewers,
 * their decisions, and overall approval progress.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: {
        workspace: true,
        reviewers: {
          with: {
            user: true,
            assigner: true,
          },
        },
        approvalDecisions: {
          with: {
            reviewer: true,
          },
        },
      },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_READ);

    const workflowSettings = await getWorkflowSettings(post.workspaceId);

    const approvedCount = post.approvalDecisions.filter(
      (d) => d.decision === "approved"
    ).length;

    return NextResponse.json({
      postId: id,
      status: post.status,
      workflow: workflowSettings,
      reviewers: post.reviewers.map((r) => {
        const latestDecision = post.approvalDecisions
          .filter((d) => d.reviewerId === r.userId)
          .sort(
            (a, b) =>
              new Date(b.createdAt ?? 0).getTime() -
              new Date(a.createdAt ?? 0).getTime()
          )[0];

        return {
          id: r.id,
          userId: r.userId,
          userName: r.user?.name ?? null,
          userEmail: r.user?.email ?? null,
          userImage: r.user?.image ?? null,
          assignedBy: r.assigner?.name ?? null,
          assignedAt: r.assignedAt,
          decision: latestDecision?.decision ?? null,
          decisionComment: latestDecision?.comment ?? null,
          decisionAt: latestDecision?.createdAt ?? null,
        };
      }),
      approvalProgress: {
        approvedCount,
        requiredApprovers: workflowSettings.requiredApprovers,
        isApproved: approvedCount >= workflowSettings.requiredApprovers,
      },
    });
  })(_request);
}

/**
 * POST /api/content/[id]/review
 *
 * Submits a post for review, transitioning its status from "draft" to "in_review".
 * Requires content:edit permission on the workspace.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_EDIT);

    const workflowSettings = await getWorkflowSettings(post.workspaceId);

    if (!workflowSettings.enabled) {
      throw new AppError(
        "Approval workflow is not enabled for this workspace",
        ERROR_CODES.BAD_REQUEST
      );
    }

    const currentStatus = post.status ?? "draft";

    if (!canTransitionStatus(currentStatus, "in_review", true)) {
      throw new AppError(
        `Cannot submit for review: post status is "${currentStatus}". Only drafts can be submitted for review.`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const [updated] = await db
      .update(posts)
      .set({ status: "in_review" })
      .where(eq(posts.id, id))
      .returning();

    // Log activity for audit trail
    await db.insert(workspaceActivity).values({
      workspaceId: post.workspaceId,
      userId: session.user.id,
      action: "post_submitted_for_review",
      resourceType: "post",
      resourceId: id,
      metadata: {
        previousStatus: currentStatus,
        newStatus: "in_review",
      },
    });

    return NextResponse.json(updated);
  })(_request);
}
