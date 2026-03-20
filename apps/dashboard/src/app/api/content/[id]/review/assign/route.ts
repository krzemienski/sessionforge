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

export const dynamic = "force-dynamic";

/**
 * POST /api/content/[id]/review/assign
 *
 * Assigns reviewers to a post. Only workspace owners can assign reviewers.
 * Reviewers must be existing workspace members.
 *
 * Body: { reviewerIds: string[] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workflowSettings = await getWorkflowSettings(post.workspaceId);

  if (!workflowSettings.enabled) {
    return NextResponse.json(
      { error: "Approval workflow is not enabled for this workspace" },
      { status: 400 }
    );
  }

  let body: { reviewerIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { reviewerIds } = body;

  if (!reviewerIds || !Array.isArray(reviewerIds) || reviewerIds.length === 0) {
    return NextResponse.json(
      { error: "reviewerIds must be a non-empty array of user IDs" },
      { status: 400 }
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

  const invalidIds = reviewerIds.filter((rid) => !memberIds.has(rid));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      {
        error: `The following user IDs are not workspace members: ${invalidIds.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
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
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to assign reviewers",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/content/[id]/review/assign
 *
 * Removes a reviewer from a post.
 *
 * Body: { reviewerId: string } (the user ID of the reviewer to remove)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { reviewerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { reviewerId } = body;

  if (!reviewerId || typeof reviewerId !== "string") {
    return NextResponse.json(
      { error: "reviewerId is required" },
      { status: 400 }
    );
  }

  const deleted = await db
    .delete(postReviewers)
    .where(
      and(eq(postReviewers.postId, id), eq(postReviewers.userId, reviewerId))
    )
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json(
      { error: "Reviewer not found for this post" },
      { status: 404 }
    );
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
}
