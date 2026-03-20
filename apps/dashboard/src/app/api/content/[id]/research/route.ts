import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, researchItems } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── Validation ──────────────────────────────────────────────────────────────

const VALID_TYPES = [
  "link",
  "note",
  "code_snippet",
  "session_snippet",
] as const;

const researchItemCreateSchema = z.object({
  type: z.enum(VALID_TYPES),
  title: z.string().min(1, "title is required"),
  content: z.string().optional(),
  url: z.string().url().optional(),
  tags: z.array(z.string()).optional().default([]),
  credibilityRating: z.number().int().min(1).max(5).optional(),
  sessionId: z.string().optional(),
  messageIndex: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getPostWithAuth(
  postId: string,
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
): Promise<{
  post: NonNullable<Awaited<ReturnType<typeof db.query.posts.findFirst>>>;
}> {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post) {
    throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
  }

  await getAuthorizedWorkspaceById(session, post.workspaceId, permission);

  return { post };
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { post } = await getPostWithAuth(id, session, PERMISSIONS.CONTENT_READ);

    // Optional tag filter via query params
    const { searchParams } = new URL(request.url);
    const tagFilter = searchParams.get("tag");

    const items = await db.query.researchItems.findMany({
      where: and(
        eq(researchItems.postId, id),
        eq(researchItems.workspaceId, post.workspaceId)
      ),
    });

    // Apply tag filter in-memory (JSONB array filtering)
    const filtered = tagFilter
      ? items.filter((item) => {
          const tags = (item.tags as string[]) ?? [];
          return tags.includes(tagFilter);
        })
      : items;

    return NextResponse.json({ items: filtered });
  })(request);
}

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { post } = await getPostWithAuth(id, session, PERMISSIONS.CONTENT_CREATE);

    const rawBody = await request.json().catch(() => ({}));
    const data = parseBody(researchItemCreateSchema, rawBody);

    const [inserted] = await db
      .insert(researchItems)
      .values({
        postId: id,
        workspaceId: post.workspaceId,
        type: data.type,
        title: data.title,
        content: data.content,
        url: data.url,
        tags: data.tags,
        credibilityRating: data.credibilityRating,
        sessionId: data.sessionId,
        messageIndex: data.messageIndex,
        metadata: data.metadata,
      })
      .returning();

    return NextResponse.json({ item: inserted }, { status: 201 });
  })(request);
}
