import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postRevisions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import {
  getRevision,
  getRevisionContent,
  computeLineDiff,
} from "@/lib/revisions/manager";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
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

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_READ);

    const url = new URL(request.url);
    const fromId = url.searchParams.get("from");
    const toId = url.searchParams.get("to");

    if (!fromId || !toId) {
      throw new AppError(
        "Query parameters 'from' and 'to' are required",
        ERROR_CODES.BAD_REQUEST
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
      throw new AppError("Source revision not found", ERROR_CODES.NOT_FOUND);
    }

    if (!toCheck) {
      throw new AppError("Target revision not found", ERROR_CODES.NOT_FOUND);
    }

    const [fromContent, toContent, fromVersion, toVersion] = await Promise.all([
      getRevisionContent(fromId),
      getRevisionContent(toId),
      getRevision(fromId),
      getRevision(toId),
    ]);

    const diff = computeLineDiff(fromContent, toContent);

    return NextResponse.json({ diff, fromVersion, toVersion });
  })(request);
}
