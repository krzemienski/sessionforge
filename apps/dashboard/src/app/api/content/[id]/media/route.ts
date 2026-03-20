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
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
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

async function getPostWithAuth(
  postId: string,
  session: Parameters<typeof getAuthorizedWorkspaceById>[0],
  permission: Parameters<typeof getAuthorizedWorkspaceById>[2]
) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { workspace: true },
  });

  if (!post) {
    throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
  }

  await getAuthorizedWorkspaceById(session, post.workspaceId, permission);

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

    const { post } = await getPostWithAuth(id, session, PERMISSIONS.CONTENT_READ);

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

    const { post } = await getPostWithAuth(id, session, PERMISSIONS.CONTENT_EDIT);

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

    const { post } = await getPostWithAuth(id, session, PERMISSIONS.CONTENT_DELETE);

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
