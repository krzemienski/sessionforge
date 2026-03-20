import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postRevisions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { getRevisionContent } from "@/lib/revisions/manager";
import { updatePost } from "@/lib/ai/tools/post-manager";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_EDIT);

    const body = await request.json();
    const { revisionId } = body;

    if (!revisionId) {
      throw new AppError("revisionId is required", ERROR_CODES.BAD_REQUEST);
    }

    // Verify the revision belongs to this post
    const revisionCheck = await db.query.postRevisions.findFirst({
      where: and(
        eq(postRevisions.id, revisionId),
        eq(postRevisions.postId, id)
      ),
    });

    if (!revisionCheck) {
      throw new AppError("Revision not found", ERROR_CODES.NOT_FOUND);
    }

    const restoredContent = await getRevisionContent(revisionId);

    const updated = await updatePost(post.workspaceId, id, {
      markdown: restoredContent,
      versionType: "major",
      editType: "restore",
      createdBy: session.user.id,
    });

    return NextResponse.json(updated);
  })(request);
}
