import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  posts,
  approvalDecisions,
  workspaceActivity,
} from "@sessionforge/db";
import { eq } from "drizzle-orm";
import {
  getWorkflowSettings,
  isAssignedReviewer,
  isApprovedForPublish,
} from "@/lib/approval/workflow-engine";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_DECISIONS = ["approved", "rejected", "changes_requested"] as const;
type Decision = (typeof VALID_DECISIONS)[number];

/**
 * POST /api/content/[id]/review/decide
 *
 * Allows an assigned reviewer to submit an approval decision (approve, reject,
 * or request changes) with an optional comment. When the decision results in
 * meeting the required approval threshold, the post status is automatically
 * transitioned to "approved".
 */
export async function POST(
  request: Request,
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

    // Verify workspace access (content:read is sufficient for reviewers)
    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_READ);

    // Verify workflow is enabled
    const workflowSettings = await getWorkflowSettings(post.workspaceId);
    if (!workflowSettings.enabled) {
      throw new AppError(
        "Approval workflow is not enabled for this workspace",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Verify the user is an assigned reviewer
    const isReviewer = await isAssignedReviewer(id, session.user.id);
    if (!isReviewer) {
      throw new AppError(
        "Only assigned reviewers can submit decisions",
        ERROR_CODES.FORBIDDEN
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { decision, comment } = body as {
      decision?: string;
      comment?: string;
    };

    if (!decision || !VALID_DECISIONS.includes(decision as Decision)) {
      throw new AppError(
        `Invalid decision. Must be one of: ${VALID_DECISIONS.join(", ")}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Insert the approval decision
    const [newDecision] = await db
      .insert(approvalDecisions)
      .values({
        postId: id,
        reviewerId: session.user.id,
        decision: decision as Decision,
        comment: comment ?? null,
      })
      .returning();

    // Log activity for audit trail
    await db.insert(workspaceActivity).values({
      workspaceId: post.workspaceId,
      userId: session.user.id,
      action: "review_decision_submitted",
      resourceType: "post",
      resourceId: id,
      metadata: {
        decision,
        comment: comment ?? null,
        postTitle: post.title,
      },
    });

    // If the decision is "approved", check whether the post now meets the
    // approval threshold and auto-transition its status to "approved".
    let postStatusUpdated = false;
    if (decision === "approved") {
      const approvalStatus = await isApprovedForPublish(id, post.workspaceId);
      if (
        approvalStatus.isApproved &&
        post.status !== "approved" &&
        post.status !== "published"
      ) {
        await db
          .update(posts)
          .set({ status: "approved" })
          .where(eq(posts.id, id));

        await db.insert(workspaceActivity).values({
          workspaceId: post.workspaceId,
          userId: session.user.id,
          action: "post_approved",
          resourceType: "post",
          resourceId: id,
          metadata: {
            previousStatus: post.status,
            newStatus: "approved",
            approvalCount: approvalStatus.approvalCount,
            requiredApprovers: approvalStatus.requiredApprovers,
          },
        });

        postStatusUpdated = true;
      }
    }

    return NextResponse.json({
      decision: newDecision,
      postStatusUpdated,
    });
  })(request);
}
