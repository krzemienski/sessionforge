import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, scheduledPublications } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { createPublishSchedule, deleteTriggerSchedule } from "@/lib/qstash";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.status !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled posts can be rescheduled" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { scheduledFor } = body;

  if (!scheduledFor) {
    return NextResponse.json(
      { error: "scheduledFor is required" },
      { status: 400 }
    );
  }

  try {
    const newScheduledDate = new Date(scheduledFor);

    // Validate that the scheduled time is in the future
    if (newScheduledDate <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    // Delete the old QStash schedule if it exists
    if (existing.qstashScheduleId) {
      try {
        await deleteTriggerSchedule(existing.qstashScheduleId);
      } catch (error) {
        // Continue anyway - we'll create a new schedule
      }
    }

    // Create new QStash schedule
    const newQstashScheduleId = await createPublishSchedule(id, newScheduledDate);

    // Update post with new scheduled time and QStash schedule ID
    await db
      .update(posts)
      .set({
        scheduledFor: newScheduledDate,
        qstashScheduleId: newQstashScheduleId,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));

    // Update scheduledPublications record
    await db
      .update(scheduledPublications)
      .set({
        scheduledFor: newScheduledDate,
        qstashScheduleId: newQstashScheduleId,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPublications.postId, id));

    // Fetch the updated post
    const updatedPost = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true, insight: true },
    });

    return NextResponse.json({
      success: true,
      post: updatedPost,
      qstashScheduleId: newQstashScheduleId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reschedule post" },
      { status: 500 }
    );
  }
}
