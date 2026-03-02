import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { streamRepurposeWriter } from "@/lib/ai/agents/repurpose-writer";

export const dynamic = "force-dynamic";

const VALID_TARGET_FORMATS = [
  "twitter_thread",
  "linkedin_post",
  "changelog",
  "tldr",
] as const;

type TargetFormat = (typeof VALID_TARGET_FORMATS)[number];

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, sourcePostId, targetFormat, customInstructions } = body;

  if (!workspaceSlug || !sourcePostId || !targetFormat) {
    return NextResponse.json(
      { error: "workspaceSlug, sourcePostId, and targetFormat are required" },
      { status: 400 }
    );
  }

  if (!VALID_TARGET_FORMATS.includes(targetFormat as TargetFormat)) {
    return NextResponse.json(
      { error: "targetFormat must be one of: twitter_thread, linkedin_post, changelog, tldr" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const sourcePost = await db.query.posts.findFirst({
    where: eq(posts.id, sourcePostId),
  });

  if (!sourcePost || sourcePost.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Source post not found" }, { status: 404 });
  }

  return streamRepurposeWriter({
    workspaceId: workspace.id,
    sourcePostId,
    targetFormat: targetFormat as TargetFormat,
    customInstructions,
  });
}
