import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portfolioSettings, posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";
import { parseBody } from "@/lib/validation";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MAX_PINNED_POSTS = 5;

// Validation schema for POST/DELETE
const pinnedPostRequestSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  postId: z.string().min(1, "postId is required"),
});

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await request.json().catch(() => ({}));
    const data = parseBody(pinnedPostRequestSchema, rawBody);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      data.workspaceSlug,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    // Verify post exists and belongs to workspace
    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, data.postId), eq(posts.workspaceId, workspace.id)),
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    // Get or create portfolio settings
    let settings = await db.query.portfolioSettings.findFirst({
      where: eq(portfolioSettings.workspaceId, workspace.id),
    });

    // Initialize pinnedPostIds array
    let currentPinnedIds: string[] = [];
    if (settings?.pinnedPostIds && Array.isArray(settings.pinnedPostIds)) {
      currentPinnedIds = settings.pinnedPostIds as string[];
    }

    // Check if already pinned
    if (currentPinnedIds.includes(data.postId)) {
      return NextResponse.json({
        pinnedPostIds: currentPinnedIds,
        message: "Post is already pinned",
      });
    }

    // Check max limit
    if (currentPinnedIds.length >= MAX_PINNED_POSTS) {
      throw new AppError(
        `Maximum ${MAX_PINNED_POSTS} posts can be pinned`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Add to pinned posts
    const updatedPinnedIds = [...currentPinnedIds, data.postId];

    // Update or create settings
    let result;
    if (settings) {
      [result] = await db
        .update(portfolioSettings)
        .set({ pinnedPostIds: updatedPinnedIds })
        .where(eq(portfolioSettings.workspaceId, workspace.id))
        .returning();
    } else {
      [result] = await db
        .insert(portfolioSettings)
        .values({
          workspaceId: workspace.id,
          pinnedPostIds: updatedPinnedIds,
        })
        .returning();
    }

    return NextResponse.json({
      pinnedPostIds: result.pinnedPostIds,
      message: "Post pinned successfully",
    });
  })(request);
}

export async function DELETE(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await request.json().catch(() => ({}));
    const data = parseBody(pinnedPostRequestSchema, rawBody);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      data.workspaceSlug,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    // Get portfolio settings
    const settings = await db.query.portfolioSettings.findFirst({
      where: eq(portfolioSettings.workspaceId, workspace.id),
    });

    if (!settings) {
      throw new AppError("Portfolio settings not found", ERROR_CODES.NOT_FOUND);
    }

    // Initialize pinnedPostIds array
    let currentPinnedIds: string[] = [];
    if (settings.pinnedPostIds && Array.isArray(settings.pinnedPostIds)) {
      currentPinnedIds = settings.pinnedPostIds as string[];
    }

    // Check if post is pinned
    if (!currentPinnedIds.includes(data.postId)) {
      return NextResponse.json({
        pinnedPostIds: currentPinnedIds,
        message: "Post is not pinned",
      });
    }

    // Remove from pinned posts
    const updatedPinnedIds = currentPinnedIds.filter((id) => id !== data.postId);

    // Update settings
    const [result] = await db
      .update(portfolioSettings)
      .set({ pinnedPostIds: updatedPinnedIds })
      .where(eq(portfolioSettings.workspaceId, workspace.id))
      .returning();

    return NextResponse.json({
      pinnedPostIds: result.pinnedPostIds,
      message: "Post unpinned successfully",
    });
  })(request);
}
