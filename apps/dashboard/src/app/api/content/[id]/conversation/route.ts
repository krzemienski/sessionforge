import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postConversations } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!post) throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    if (post.workspace.ownerId !== session.user.id)
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);

    const conversation = await db.query.postConversations.findFirst({
      where: and(
        eq(postConversations.postId, id),
        eq(postConversations.workspaceId, post.workspaceId)
      ),
    });

    return NextResponse.json({ messages: conversation?.messages ?? [] });
  })(request);
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!post) throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    if (post.workspace.ownerId !== session.user.id)
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);

    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const existing = await db.query.postConversations.findFirst({
      where: and(
        eq(postConversations.postId, id),
        eq(postConversations.workspaceId, post.workspaceId)
      ),
    });

    if (existing) {
      await db
        .update(postConversations)
        .set({ messages, updatedAt: new Date() })
        .where(eq(postConversations.id, existing.id));
    } else {
      await db.insert(postConversations).values({
        postId: id,
        workspaceId: post.workspaceId,
        messages,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ ok: true });
  })(request);
}
