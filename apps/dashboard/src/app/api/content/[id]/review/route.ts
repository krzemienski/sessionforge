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
import { eq, and } from "drizzle-orm";
import {
  getWorkflowSettings,
  canTransitionStatus,
  WorkflowError,
} from "@/lib/approval/workflow-engine";

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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
}

/**
 * POST /api/content/[id]/review
 *
 * Submits a post for review, transitioning its status from "draft" to "in_review".
 * Only the workspace owner can submit posts for review.
 */
export async function POST(
  _request: Request,
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

  const currentStatus = post.status ?? "draft";

  if (!canTransitionStatus(currentStatus, "in_review", true)) {
    return NextResponse.json(
      {
        error: `Cannot submit for review: post status is "${currentStatus}". Only drafts can be submitted for review.`,
      },
      { status: 400 }
    );
  }

  try {
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
  } catch (error) {
    if (error instanceof WorkflowError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit for review",
      },
      { status: 500 }
    );
  }
}
