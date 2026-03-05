import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { updatePost } from "@/lib/ai/tools/post-manager";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, contentUpdateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withFrontmatter } from "@/lib/seo/frontmatter";

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
      with: { workspace: true, insight: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    if (post.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("frontmatter") === "true") {
      return NextResponse.json({
        ...post,
        markdown: withFrontmatter(post.markdown ?? "", post.title, post.seoMetadata ?? {}),
        hasFrontmatter: true,
      });
    }

    return NextResponse.json(post);
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

    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    if (existing.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    const rawBody = await request.json().catch(() => ({}));
    const { title, markdown, status, toneUsed, badgeEnabled, platformFooterEnabled } = parseBody(contentUpdateSchema, rawBody);

    const updated = await updatePost(existing.workspaceId, id, {
      title,
      markdown,
      status: status as Parameters<typeof updatePost>[2]["status"],
      toneUsed: toneUsed as Parameters<typeof updatePost>[2]["toneUsed"],
      badgeEnabled,
      platformFooterEnabled,
    });

    return NextResponse.json(updated);
  })(request);
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    if (existing.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    await db.delete(posts).where(eq(posts.id, id));

    return NextResponse.json({ deleted: true });
  })(request);
}
