import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postRevisions } from "@sessionforge/db";
import { eq, count } from "drizzle-orm/sql";
import { listRevisions } from "@/lib/revisions/manager";
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
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const [revisions, [{ total }]] = await Promise.all([
      listRevisions(id, { limit, offset }),
      db
        .select({ total: count() })
        .from(postRevisions)
        .where(eq(postRevisions.postId, id)),
    ]);

    return NextResponse.json({ revisions, total });
  })(request);
}
