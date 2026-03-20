import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, scheduledPublications } from "@sessionforge/db";
import { eq, and, asc, or, desc } from "drizzle-orm";
import { createPublishSchedule } from "@/lib/qstash";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.CONTENT_READ
  );

  const results = await db.query.posts.findMany({
    where: and(
      eq(posts.workspaceId, workspace.id),
      eq(posts.status, "scheduled")
    ),
    orderBy: [asc(posts.scheduledFor)],
  });

  const recentActivity = await db.query.scheduledPublications.findMany({
    where: and(
      eq(scheduledPublications.workspaceId, workspace.id),
      or(
        eq(scheduledPublications.status, "published"),
        eq(scheduledPublications.status, "failed")
      )
    ),
    with: { post: true },
    orderBy: [desc(scheduledPublications.updatedAt)],
    limit: 10,
  });

  return NextResponse.json({ posts: results, recentActivity });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { postId, workspaceSlug, scheduledFor, timezone, platforms } = body;

  if (!postId || !workspaceSlug || !scheduledFor || !timezone || !platforms) {
    return NextResponse.json(
      { error: "postId, workspaceSlug, scheduledFor, timezone, and platforms are required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json(
      { error: "platforms must be a non-empty array" },
      { status: 400 }
    );
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.CONTENT_CREATE
  );

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.workspaceId, workspace.id)),
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft posts can be scheduled" },
      { status: 400 }
    );
  }

  try {
    const scheduledDate = new Date(scheduledFor);

    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    const qstashScheduleId = await createPublishSchedule(postId, scheduledDate);

    await db
      .update(posts)
      .set({
        status: "scheduled",
        scheduledFor: scheduledDate,
        timezone,
        qstashScheduleId,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    const [scheduledPublication] = await db
      .insert(scheduledPublications)
      .values({
        workspaceId: workspace.id,
        postId,
        platforms,
        scheduledFor: scheduledDate,
        status: "pending",
        qstashScheduleId,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        scheduledPublication,
        qstashScheduleId,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to schedule post" },
      { status: 500 }
    );
  }
}
