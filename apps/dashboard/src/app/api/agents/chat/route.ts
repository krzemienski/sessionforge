import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { streamEditorChat } from "@/lib/ai/agents/editor-chat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, postId, message, conversationHistory } = body;

  if (!workspaceSlug || !postId || !message) {
    return NextResponse.json(
      { error: "workspaceSlug, postId, and message are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Verify post belongs to workspace
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post || post.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return streamEditorChat({
    workspaceId: workspace.id,
    postId,
    userMessage: message,
    conversationHistory,
  });
}
