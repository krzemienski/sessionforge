import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postRevisions } from "@sessionforge/db";
import { eq, count } from "drizzle-orm/sql";
import { listRevisions } from "@/lib/revisions/manager";

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
}
