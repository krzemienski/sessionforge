import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { updatePost } from "@/lib/ai/tools/post-manager";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: {
        workspace: true,
        insight: true,
        seriesPosts: {
          with: {
            series: true,
          },
        },
      },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_READ);

    return NextResponse.json(post);
  })(_request);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, existing.workspaceId, PERMISSIONS.CONTENT_EDIT);

    const body = await request.json();
    const { title, markdown, status, toneUsed, badgeEnabled, platformFooterEnabled, versionType, editType } = body;

    const updated = await updatePost(existing.workspaceId, id, {
      title,
      markdown,
      status,
      toneUsed,
      badgeEnabled,
      platformFooterEnabled,
      versionType,
      editType,
      createdBy: session.user.id,
    });

    return NextResponse.json(updated);
  })(request);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, existing.workspaceId, PERMISSIONS.CONTENT_EDIT);

    const body = await request.json();
    const {
      metaTitle,
      metaDescription,
      ogImage,
      keywords,
      structuredData,
      readabilityScore,
      geoScore,
      geoChecklist,
      seoAnalysis,
    } = body;

    const updated = await updatePost(existing.workspaceId, id, {
      metaTitle,
      metaDescription,
      ogImage,
      keywords,
      structuredData,
      readabilityScore,
      geoScore,
      geoChecklist,
      seoAnalysis,
    });

    return NextResponse.json(updated);
  })(request);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, existing.workspaceId, PERMISSIONS.CONTENT_DELETE);

    await db.delete(posts).where(eq(posts.id, id));

    return NextResponse.json({ deleted: true });
  })(_request);
}
