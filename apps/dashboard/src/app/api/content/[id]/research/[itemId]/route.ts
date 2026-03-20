import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, researchItems } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── Validation ──────────────────────────────────────────────────────────────

const VALID_TYPES = [
  "link",
  "note",
  "code_snippet",
  "session_snippet",
] as const;

const researchItemUpdateSchema = z.object({
  type: z.enum(VALID_TYPES).optional(),
  title: z.string().min(1, "title is required").optional(),
  content: z.string().optional(),
  url: z.string().url().optional().nullable(),
  tags: z.array(z.string()).optional(),
  credibilityRating: z.number().int().min(1).max(5).optional().nullable(),
  sessionId: z.string().optional().nullable(),
  messageIndex: z.number().int().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifyResearchItemOwnership(
  postId: string,
  itemId: string,
  userId: string
) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { workspace: true },
  });

  if (!post) {
    throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
  }

  if (post.workspace.ownerId !== userId) {
    throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
  }

  const item = await db.query.researchItems.findFirst({
    where: and(
      eq(researchItems.id, itemId),
      eq(researchItems.postId, postId)
    ),
  });

  if (!item) {
    throw new AppError("Research item not found", ERROR_CODES.NOT_FOUND);
  }

  return { post, item };
}

// ── PATCH — update research item ────────────────────────────────────────────

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    await verifyResearchItemOwnership(id, itemId, session.user.id);

    const rawBody = await request.json().catch(() => ({}));
    const data = parseBody(researchItemUpdateSchema, rawBody);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.type !== undefined) updateData.type = data.type;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.credibilityRating !== undefined)
      updateData.credibilityRating = data.credibilityRating;
    if (data.sessionId !== undefined) updateData.sessionId = data.sessionId;
    if (data.messageIndex !== undefined)
      updateData.messageIndex = data.messageIndex;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const [updated] = await db
      .update(researchItems)
      .set(updateData)
      .where(eq(researchItems.id, itemId))
      .returning();

    return NextResponse.json({ item: updated });
  })(request);
}

// ── DELETE — remove research item ───────────────────────────────────────────

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    await verifyResearchItemOwnership(id, itemId, session.user.id);

    await db
      .delete(researchItems)
      .where(eq(researchItems.id, itemId));

    return NextResponse.json({ success: true }, { status: 200 });
  })(request);
}
