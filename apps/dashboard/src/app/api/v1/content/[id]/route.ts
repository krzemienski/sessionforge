import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { authenticateApiKey, apiResponse, apiError } from "@/lib/api-auth";
import { updatePost } from "@/lib/ai/tools/post-manager";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiError("Unauthorized", 401);

  const { id } = await params;
  const wsId = auth.workspace.id;

  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.workspaceId, wsId)),
  });

  if (!existing) {
    return apiError("Post not found", 404);
  }

  let body: { title?: string; markdown?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const { title, markdown, status } = body;

  try {
    const updated = await updatePost(wsId, id, {
      title,
      markdown,
      status: status as Parameters<typeof updatePost>[2]["status"],
    });

    return apiResponse(updated, {});
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Update failed",
      500
    );
  }
}
