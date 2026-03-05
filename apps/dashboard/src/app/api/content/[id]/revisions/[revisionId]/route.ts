import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postRevisions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { getRevision, getRevisionContent } from "@/lib/revisions/manager";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, revisionId } = await params;

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

  // Verify the revision belongs to this post
  const revisionCheck = await db.query.postRevisions.findFirst({
    where: and(
      eq(postRevisions.id, revisionId),
      eq(postRevisions.postId, id)
    ),
  });

  if (!revisionCheck) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  try {
    const [revision, markdown] = await Promise.all([
      getRevision(revisionId),
      getRevisionContent(revisionId),
    ]);

    return NextResponse.json({ ...revision, markdown });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retrieve revision" },
      { status: 500 }
    );
  }
}
