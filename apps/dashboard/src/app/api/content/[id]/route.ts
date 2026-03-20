import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { updatePost } from "@/lib/ai/tools/post-manager";
import { canPublish, getOverridePolicy } from "@/lib/verification/publish-gate";
import {
  validateStatusTransition,
  WorkflowError,
} from "@/lib/approval/workflow-engine";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(post);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

      // Verify override permission (owner role since they own the workspace)
      const overridePolicy = getOverridePolicy("owner");
      if (!overridePolicy.canOverride) {
        return NextResponse.json(
          { error: "Insufficient permissions to override risk flags" },
          { status: 403 }
        );
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

  try {
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  try {
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(posts).where(eq(posts.id, id));

  return NextResponse.json({ deleted: true });
}
