import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postRevisions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import {
  getRevision,
  getRevisionContent,
  computeLineDiff,
} from "@/lib/revisions/manager";

export const dynamic = "force-dynamic";

export async function GET(
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

  const url = new URL(request.url);
  const fromId = url.searchParams.get("from");
  const toId = url.searchParams.get("to");

  if (!fromId || !toId) {
    return NextResponse.json(
      { error: "Query parameters 'from' and 'to' are required" },
      { status: 400 }
    );
  }

  // Verify both revisions belong to this post
  const [fromCheck, toCheck] = await Promise.all([
    db.query.postRevisions.findFirst({
      where: and(eq(postRevisions.id, fromId), eq(postRevisions.postId, id)),
    }),
    db.query.postRevisions.findFirst({
      where: and(eq(postRevisions.id, toId), eq(postRevisions.postId, id)),
    }),
  ]);

  if (!fromCheck) {
    return NextResponse.json(
      { error: "Source revision not found" },
      { status: 404 }
    );
  }

  if (!toCheck) {
    return NextResponse.json(
      { error: "Target revision not found" },
      { status: 404 }
    );
  }

  try {
    const [fromContent, toContent, fromVersion, toVersion] = await Promise.all([
      getRevisionContent(fromId),
      getRevisionContent(toId),
      getRevision(fromId),
      getRevision(toId),
    ]);

    const diff = computeLineDiff(fromContent, toContent);

    return NextResponse.json({ diff, fromVersion, toVersion });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute diff" },
      { status: 500 }
    );
  }
}
