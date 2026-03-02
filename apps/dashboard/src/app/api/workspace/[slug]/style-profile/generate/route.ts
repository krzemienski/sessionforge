import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, writingStyleProfiles, posts } from "@sessionforge/db";
import { eq, and, count, isNotNull } from "drizzle-orm";
import { analyzeWritingStyle } from "@/lib/ai/agents/style-learner";

export const dynamic = "force-dynamic";

const MIN_POSTS_REQUIRED = 5;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, session.user.id),
        eq(workspaces.slug, slug)
      )
    )
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const wsId = workspace[0].id;

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
    return NextResponse.json(
      { status: "insufficient_data", publishedCount },
      { status: 400 }
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
}
