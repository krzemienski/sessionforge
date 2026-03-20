import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  posts,
  postReviewers,
  workspaceMembers,
  workspaceActivity,
} from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { getWorkflowSettings } from "@/lib/approval/workflow-engine";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/content/[id]/review/assign
 *
 * Assigns reviewers to a post. Requires workspace:members permission.
 * Reviewers must be existing workspace members.
 *
 * Body: { reviewerIds: string[] }
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

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.WORKSPACE_MEMBERS);

    const workflowSettings = await getWorkflowSettings(post.workspaceId);

    if (!workflowSettings.enabled) {
      throw new AppError(
        "Approval workflow is not enabled for this workspace",
        ERROR_CODES.BAD_REQUEST
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reviewerIds } = body;

    if (!reviewerIds || !Array.isArray(reviewerIds) || reviewerIds.length === 0) {
      throw new AppError(
        "reviewerIds must be a non-empty array of user IDs",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Verify all reviewer IDs are workspace members
    const members = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, post.workspaceId));

    const memberIds = new Set(members.map((m) => m.userId));
    // Also include workspace owner as a valid reviewer
    memberIds.add(post.workspace.ownerId);

    const invalidIds = reviewerIds.filter((rid: string) => !memberIds.has(rid));
    if (invalidIds.length > 0) {
      throw new AppError(
        `The following user IDs are not workspace members: ${invalidIds.join(", ")}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Insert reviewers, ignoring duplicates (unique constraint on postId+userId)
    const inserted = [];
    for (const userId of reviewerIds) {
      // Check if already assigned
      const existing = await db.query.postReviewers.findFirst({
        where: and(
          eq(postReviewers.postId, id),
          eq(postReviewers.userId, userId)
        ),
      });

      if (!existing) {
        const [reviewer] = await db
          .insert(postReviewers)
          .values({
            postId: id,
            userId,
            assignedBy: session.user.id,
          })
          .returning();
        inserted.push(reviewer);
      }
    }

    // Log activity for audit trail
    await db.insert(workspaceActivity).values({
      workspaceId: post.workspaceId,
      userId: session.user.id,
      action: "reviewers_assigned",
      resourceType: "post",
      resourceId: id,
      metadata: {
        reviewerIds,
        assignedCount: inserted.length,
        skippedCount: reviewerIds.length - inserted.length,
      },
    });

    // Return updated reviewer list
    const allReviewers = await db.query.postReviewers.findMany({
      where: eq(postReviewers.postId, id),
      with: {
        user: true,
        assigner: true,
      },
    });

    return NextResponse.json({
      assigned: inserted.length,
      skipped: reviewerIds.length - inserted.length,
      reviewers: allReviewers.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.name ?? null,
        userEmail: r.user?.email ?? null,
        userImage: r.user?.image ?? null,
        assignedBy: r.assigner?.name ?? null,
        assignedAt: r.assignedAt,
      })),
    });
  })(request);
}

/**
 * DELETE /api/content/[id]/review/assign
 *
 * Removes a reviewer from a post. Requires workspace:members permission.
 *
 * Body: { reviewerId: string } (the user ID of the reviewer to remove)
 */
export async function DELETE(
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

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.WORKSPACE_MEMBERS);

    const body = await request.json().catch(() => ({}));
    const { reviewerId } = body;

    if (!reviewerId || typeof reviewerId !== "string") {
      throw new AppError("reviewerId is required", ERROR_CODES.BAD_REQUEST);
    }

    const deleted = await db
      .delete(postReviewers)
      .where(
        and(eq(postReviewers.postId, id), eq(postReviewers.userId, reviewerId))
      )
      .returning();

    if (deleted.length === 0) {
      throw new AppError("Reviewer not found for this post", ERROR_CODES.NOT_FOUND);
    }

    // Log activity
    await db.insert(workspaceActivity).values({
      workspaceId: post.workspaceId,
      userId: session.user.id,
      action: "reviewer_removed",
      resourceType: "post",
      resourceId: id,
      metadata: { removedReviewerId: reviewerId },
    });

    return NextResponse.json({ removed: true });
  })(request);
}
