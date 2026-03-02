import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, workspaces, toneProfileEnum } from "@sessionforge/db";
import { eq, desc, and, gte, lte, ilike } from "drizzle-orm";
import { createPost, type CreatePostInput } from "@/lib/ai/tools/post-manager";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const contentType = searchParams.get("type");
  const status = searchParams.get("status");
  const toneUsed = searchParams.get("toneUsed");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const conditions = [eq(posts.workspaceId, workspace.id)];
  if (contentType) {
    conditions.push(eq(posts.contentType, contentType as typeof posts.contentType.enumValues[number]));
  }
  if (status) {
    conditions.push(eq(posts.status, status as typeof posts.status.enumValues[number]));
  }
  if (toneUsed && toneProfileEnum.enumValues.includes(toneUsed as (typeof toneProfileEnum.enumValues)[number])) {
    conditions.push(eq(posts.toneUsed, toneUsed as (typeof toneProfileEnum.enumValues)[number]));
  }
  if (dateFrom) {
    conditions.push(gte(posts.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(posts.createdAt, new Date(dateTo)));
  }
  if (search) {
    conditions.push(ilike(posts.title, `%${search}%`));
  }

  const results = await db.query.posts.findMany({
    where: and(...conditions),
    orderBy: [desc(posts.createdAt)],
    limit,
    offset,
  });

  return NextResponse.json({ posts: results, limit, offset });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, title, markdown, contentType, toneUsed, insightId } = body;

  if (!workspaceSlug || !title || !markdown || !contentType) {
    return NextResponse.json(
      { error: "workspaceSlug, title, markdown, and contentType are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const post = await createPost({
      workspaceId: workspace.id,
      title,
      markdown,
      contentType,
      toneUsed,
      insightId,
      sourceMetadata: {
        sessionIds: [],
        insightIds: insightId ? [insightId] : [],
        generatedBy: "manual",
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create post" },
      { status: 500 }
    );
  }
}
