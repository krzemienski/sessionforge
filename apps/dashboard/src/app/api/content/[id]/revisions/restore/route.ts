import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postRevisions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { getRevisionContent } from "@/lib/revisions/manager";
import { updatePost } from "@/lib/ai/tools/post-manager";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const body = await request.json();
  const { revisionId } = body;

  if (!revisionId) {
    return NextResponse.json(
      { error: "revisionId is required" },
      { status: 400 }
    );
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
    const restoredContent = await getRevisionContent(revisionId);

    const updated = await updatePost(post.workspaceId, id, {
      markdown: restoredContent,
      versionType: "major",
      editType: "restore",
      createdBy: session.user.id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restore failed" },
      { status: 500 }
    );
  }
}
