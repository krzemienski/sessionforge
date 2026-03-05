import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, contentAssets } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { generateDiagrams } from "@/lib/media/diagram-generator";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── Validation ──────────────────────────────────────────────────────────────

const generateMediaSchema = z.object({
  types: z.array(z.string()).default(["diagram"]),
});

const deleteMediaSchema = z.object({
  assetId: z.string().min(1, "assetId is required"),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifyPostOwnership(
  postId: string,
  userId: string
): Promise<{
  post: NonNullable<
    Awaited<ReturnType<typeof db.query.posts.findFirst>>
  >;
}> {
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

  return { post };
}

// ── GET — list media assets ─────────────────────────────────────────────────

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { post } = await verifyPostOwnership(id, session.user.id);

    const assets = await db.query.contentAssets.findMany({
      where: and(
        eq(contentAssets.postId, id),
        eq(contentAssets.workspaceId, post.workspaceId)
      ),
    });

    return NextResponse.json({ assets });
  })(request);
}

// ── POST — generate media assets (diagrams) ────────────────────────────────

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { post } = await verifyPostOwnership(id, session.user.id);

    const rawBody = await request.json().catch(() => ({}));
    const parsed = parseBody(generateMediaSchema, rawBody);
    const requestedTypes = parsed.types ?? ["diagram"];

    const postMarkdown = post.markdown ?? "";
    if (!postMarkdown.trim()) {
      throw new AppError(
        "Post has no content to generate diagrams from",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Currently only "diagram" type is supported
    if (!requestedTypes.includes("diagram")) {
      return NextResponse.json({ assets: [] });
    }

    const diagrams = await generateDiagrams(postMarkdown);

    if (diagrams.length === 0) {
      return NextResponse.json({ assets: [] });
    }

    const inserted = await db
      .insert(contentAssets)
      .values(
        diagrams.map((diagram) => ({
          postId: id,
          workspaceId: post.workspaceId,
          assetType: "diagram" as const,
          content: diagram.mermaidMarkup,
          altText: diagram.altText,
          caption: diagram.caption,
          placement: {
            section: diagram.suggestedSection,
            position: "after",
          },
          metadata: {
            generatedAt: new Date().toISOString(),
            model: "claude-haiku-4-5-20251001",
            diagramType: diagram.diagramType,
          },
        }))
      )
      .returning();

    return NextResponse.json({ assets: inserted });
  })(request);
}

// ── DELETE — remove a media asset ───────────────────────────────────────────

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { post } = await verifyPostOwnership(id, session.user.id);

    const rawBody = await request.json().catch(() => ({}));
    const { assetId } = parseBody(deleteMediaSchema, rawBody);

    const existing = await db.query.contentAssets.findFirst({
      where: and(
        eq(contentAssets.id, assetId),
        eq(contentAssets.workspaceId, post.workspaceId)
      ),
    });

    if (!existing) {
      throw new AppError("Asset not found", ERROR_CODES.NOT_FOUND);
    }

    await db
      .delete(contentAssets)
      .where(eq(contentAssets.id, assetId));

    return NextResponse.json({ success: true });
  })(request);
}
