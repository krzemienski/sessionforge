import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { updatePost } from "@/lib/ai/tools/post-manager";
import { canPublish, getOverridePolicy } from "@/lib/verification/publish-gate";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  validateStatusTransition,
  WorkflowError,
} from "@/lib/approval/workflow-engine";

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
    const { title, markdown, status, toneUsed, badgeEnabled, platformFooterEnabled, versionType, editType, overrideRiskFlags } = body;

    // Publish-gate check: block status transition to 'published' if critical flags exist
    if (status === "published" && existing.status !== "published") {
      const flags = existing.riskFlags ?? [];
      const gateResult = canPublish(flags);

      if (!gateResult.allowed) {
        if (!overrideRiskFlags) {
          return NextResponse.json(
            {
              error: "unresolved_critical_flags",
              flags: gateResult.blockingFlags,
              requiresOverride: true,
            },
            { status: 409 }
          );
        }

        const overridePolicy = getOverridePolicy("owner");
        if (!overridePolicy.canOverride) {
          throw new AppError("Insufficient permissions to override risk flags", ERROR_CODES.FORBIDDEN);
        }
      }
    }

    // Validate status transition and enforce approval workflow rules
    if (status && status !== existing.status) {
      try {
        await validateStatusTransition(
          id,
          existing.workspaceId,
          existing.status ?? "draft",
          status,
          session.user.id
        );
      } catch (error) {
        if (error instanceof WorkflowError) {
          const statusCode =
            error.code === "approval_required" ? 403 :
            error.code === "invalid_transition" ? 422 :
            error.code === "not_reviewer" ? 403 : 400;

          return NextResponse.json(
            {
              error: error.message,
              code: error.code,
            },
            { status: statusCode }
          );
        }
        throw error;
      }
    }

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
