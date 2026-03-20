import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postRevisions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id, revisionId } = await params;

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_EDIT);

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

    const body = await request.json();
    const { versionLabel, versionNotes } = body;

    // Validate input - at least one field should be provided
    if (versionLabel === undefined && versionNotes === undefined) {
      throw new AppError(
        "At least one of versionLabel or versionNotes must be provided",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Build update object with only provided fields
    const updateData: { versionLabel?: string | null; versionNotes?: string | null } = {};
    if (versionLabel !== undefined) {
      updateData.versionLabel = versionLabel;
    }
    if (versionNotes !== undefined) {
      updateData.versionNotes = versionNotes;
    }

    const [updated] = await db
      .update(postRevisions)
      .set(updateData)
      .where(eq(postRevisions.id, revisionId))
      .returning();

    return NextResponse.json(updated);
  })(request);
}
