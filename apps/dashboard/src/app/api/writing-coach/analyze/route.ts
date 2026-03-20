import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq, and, count, isNotNull } from "drizzle-orm/sql";
import { analyzeWorkspacePosts } from "@/lib/writing-coach";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { workspace: slug } = body;

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing workspace slug" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    slug,
    PERMISSIONS.CONTENT_READ
  );

  const wsId = workspace.id;

  // Count posts with markdown content
  const [{ value: postCount }] = await db
    .select({ value: count() })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, wsId),
        isNotNull(posts.markdown)
      )
    );

  // Fire-and-forget: analyzeWorkspacePosts handles its own DB upsert
  analyzeWorkspacePosts(wsId).catch((error) => {
    console.error(`[writing-coach/analyze] Failed to analyze workspace ${wsId}:`, error);
  });

  return NextResponse.json({ status: "analyzing", postCount });
}
