import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { requireApiKey, apiResponse, withV1ApiHandler } from "@/lib/api-auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { updatePost } from "@/lib/ai/tools/post-manager";
import { fireWebhookEvent } from "@/lib/webhooks/events";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export const PATCH = withV1ApiHandler<RouteCtx>(async (req, ctx) => {
  const auth = await requireApiKey(req as NextRequest);

  const { id } = await ctx.params;
  const wsId = auth.workspace.id;

  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.workspaceId, wsId)),
  });

  if (!existing) {
    throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
  }

  let body: { title?: string; markdown?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    throw new AppError("Invalid JSON body", ERROR_CODES.BAD_REQUEST);
  }

  const { title, markdown, status } = body;

  let updated;
  try {
    updated = await updatePost(wsId, id, {
      title,
      markdown,
      status: status as Parameters<typeof updatePost>[2]["status"],
    });
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "Update failed",
      ERROR_CODES.INTERNAL_ERROR,
    );
  }

  if (status === "published") {
    fireWebhookEvent(wsId, "content.published", {
      postId: id,
      title: updated.title,
      contentType: updated.contentType,
    });
  }

  return apiResponse(updated, {});
});
