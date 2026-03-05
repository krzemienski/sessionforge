import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, styleSettings } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
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
  const body = await req.json().catch(() => ({}));

  const {
    defaultTone,
    targetAudience,
    customInstructions,
    includeCodeSnippets,
    includeTerminalOutput,
    maxBlogWordCount,
  } = body as Record<string, unknown>;

  const updateValues: Record<string, unknown> = {};
  if (defaultTone !== undefined) updateValues.defaultTone = defaultTone;
  if (targetAudience !== undefined) updateValues.targetAudience = targetAudience;
  if (customInstructions !== undefined) updateValues.customInstructions = customInstructions;
  if (includeCodeSnippets !== undefined) updateValues.includeCodeSnippets = includeCodeSnippets;
  if (includeTerminalOutput !== undefined) updateValues.includeTerminalOutput = includeTerminalOutput;
  if (maxBlogWordCount !== undefined) updateValues.maxBlogWordCount = maxBlogWordCount;

  const existing = await db
    .select({ id: styleSettings.id })
    .from(styleSettings)
    .where(eq(styleSettings.workspaceId, wsId))
    .limit(1);

  let result;
  if (existing.length > 0) {
    [result] = await db
      .update(styleSettings)
      .set(updateValues)
      .where(eq(styleSettings.workspaceId, wsId))
      .returning();
  } else {
    [result] = await db
      .insert(styleSettings)
      .values({ workspaceId: wsId, ...updateValues })
      .returning();
  }

  return NextResponse.json(result);
}
