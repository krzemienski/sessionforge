import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, scheduledPublications } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { createPublishSchedule, cancelPublishMessage } from "@/lib/qstash";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await getAuthorizedWorkspaceById(session, existing.workspaceId, PERMISSIONS.CONTENT_EDIT);

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

    if (newScheduledDate <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    if (existing.qstashScheduleId) {
      try {
        await cancelPublishMessage(existing.qstashScheduleId);
      } catch (error) {
        // Continue anyway - we'll create a new schedule
      }
    }

    const newQstashScheduleId = await createPublishSchedule(id, newScheduledDate);

    await db
      .update(posts)
      .set({
        scheduledFor: newScheduledDate,
        qstashScheduleId: newQstashScheduleId,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));

    await db
      .update(scheduledPublications)
      .set({
        scheduledFor: newScheduledDate,
        qstashScheduleId: newQstashScheduleId,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPublications.postId, id));

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await getAuthorizedWorkspaceById(session, existing.workspaceId, PERMISSIONS.CONTENT_DELETE);

  if (existing.status !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled posts can be cancelled" },
      { status: 400 }
    );
  }

  try {
    if (existing.qstashScheduleId) {
      try {
        await cancelPublishMessage(existing.qstashScheduleId);
      } catch (error) {
        // Log but continue
      }
    }

    await db
      .update(posts)
      .set({
        status: "draft",
        scheduledFor: null,
        qstashScheduleId: null,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));

    await db
      .delete(scheduledPublications)
      .where(eq(scheduledPublications.postId, id));

    return NextResponse.json({ success: true, cancelled: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel scheduled post" },
      { status: 500 }
    );
  }
}
