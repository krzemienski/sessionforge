import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { workspaces, posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ postId: string }> }) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { postId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspaceSlug");

    if (!workspaceSlug) {
      throw new AppError("workspaceSlug is required", ERROR_CODES.VALIDATION_ERROR);
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    // Verify the source post exists and belongs to this workspace
    const sourcePost = await db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.workspaceId, workspace.id)),
    });

    if (!sourcePost) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    // Get all repurposed variants (posts where parentPostId = postId)
    const variants = await db.query.posts.findMany({
      where: and(
        eq(posts.parentPostId, postId),
        eq(posts.workspaceId, workspace.id)
      ),
      columns: {
        id: true,
        title: true,
        contentType: true,
        status: true,
        createdAt: true,
      },
      orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    });

    return new Response(JSON.stringify(variants), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })(req, ctx);
}
