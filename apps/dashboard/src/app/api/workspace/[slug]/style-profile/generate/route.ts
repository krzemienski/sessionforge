import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writingStyleProfiles, posts } from "@sessionforge/db";
import { eq, and, count, isNotNull } from "drizzle-orm/sql";
import { analyzeWritingStyle } from "@/lib/ai/agents/style-learner";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MIN_POSTS_REQUIRED = 5;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    const wsId = workspace.id;

    const [{ value: publishedCount }] = await db
      .select({ value: count() })
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, wsId),
          eq(posts.status, "published"),
          isNotNull(posts.aiDraftMarkdown)
        )
      );

    if (publishedCount < MIN_POSTS_REQUIRED) {
      throw new AppError(
        JSON.stringify({ status: "insufficient_data", publishedCount }),
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Mark as generating before firing off the background job
    await db
      .insert(writingStyleProfiles)
      .values({ workspaceId: wsId, generationStatus: "generating" })
      .onConflictDoUpdate({
        target: writingStyleProfiles.workspaceId,
        set: { generationStatus: "generating", updatedAt: new Date() },
      });

    // Fire-and-forget: analyzeWritingStyle handles its own DB upsert with 'completed' status
    analyzeWritingStyle(wsId).catch(() => {
      db.update(writingStyleProfiles)
        .set({ generationStatus: "failed", updatedAt: new Date() })
        .where(eq(writingStyleProfiles.workspaceId, wsId))
        .execute()
        .catch(() => undefined);
    });

    return NextResponse.json({ status: "generating" });
  })(req);
}
