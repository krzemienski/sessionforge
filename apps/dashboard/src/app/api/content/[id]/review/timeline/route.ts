import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  posts,
  approvalDecisions,
  workspaceActivity,
} from "@sessionforge/db";
import { eq, and, desc } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/content/[id]/review/timeline
 *
 * Returns the full approval timeline for a post, combining approval decisions
 * and status-transition activity entries into a single chronologically ordered list.
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
      with: { workspace: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_READ);

    // Fetch approval decisions with reviewer info
    const decisions = await db.query.approvalDecisions.findMany({
      where: eq(approvalDecisions.postId, id),
      with: {
        reviewer: true,
      },
      orderBy: [desc(approvalDecisions.createdAt)],
    });

    // Fetch related activity entries (status transitions, assignments, etc.)
    const REVIEW_ACTIONS = [
      "post_submitted_for_review",
      "review_decision_submitted",
      "post_approved",
      "reviewer_assigned",
      "reviewer_removed",
      "status_transition",
    ];

    const activityEntries = await db
      .select()
      .from(workspaceActivity)
      .where(
        and(
          eq(workspaceActivity.workspaceId, post.workspaceId),
          eq(workspaceActivity.resourceId, id)
        )
      )
      .orderBy(desc(workspaceActivity.createdAt));

    // Filter to review-related activity only
    const reviewActivity = activityEntries.filter((entry) =>
      REVIEW_ACTIONS.includes(entry.action)
    );

    // Build unified timeline entries
    type TimelineEntry = {
      id: string;
      type: "decision" | "activity";
      action: string;
      userId: string | null;
      userName: string | null;
      userImage: string | null;
      comment: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date | null;
    };

    const decisionEntries: TimelineEntry[] = decisions.map((d) => ({
      id: d.id,
      type: "decision" as const,
      action: `review_${d.decision}`,
      userId: d.reviewerId,
      userName: d.reviewer?.name ?? null,
      userImage: d.reviewer?.image ?? null,
      comment: d.comment,
      metadata: { decision: d.decision },
      createdAt: d.createdAt,
    }));

    const activityTimelineEntries: TimelineEntry[] = reviewActivity.map((a) => ({
      id: a.id,
      type: "activity" as const,
      action: a.action,
      userId: a.userId,
      userName: null,
      userImage: null,
      comment: null,
      metadata: a.metadata as Record<string, unknown> | null,
      createdAt: a.createdAt,
    }));

    // Merge and sort chronologically (newest first)
    const timeline = [...decisionEntries, ...activityTimelineEntries].sort(
      (a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }
    );

    return NextResponse.json({
      postId: id,
      timeline,
    });
  })(_request);
}
