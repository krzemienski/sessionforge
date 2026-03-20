import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { streamEditorChat } from "@/lib/ai/agents/editor-chat";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, agentChatSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { workspaceSlug, postId, message } = parseBody(agentChatSchema, rawBody);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_CREATE
    );

    // Verify post belongs to workspace
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!post || post.workspaceId !== workspace.id) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    return await streamEditorChat({
      workspaceId: workspace.id,
      postId,
      userMessage: message,
    });
  })(req);
}
