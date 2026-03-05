import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, workspaces } from "@sessionforge/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const results = await db.query.collections.findMany({
    where: eq(collections.workspaceId, workspace.id),
    orderBy: [desc(collections.createdAt)],
    limit,
    offset,
    with: {
      collectionPosts: {
        with: {
          post: true,
        },
      },
    },
  });

  // Transform results to include post count
  const collectionsWithCounts = results.map((c) => ({
    ...c,
    postCount: c.collectionPosts.length,
  }));

  return NextResponse.json({ collections: collectionsWithCounts, limit, offset });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const body = await request.json();
  const { title, description, slug } = body;

  if (!title || !slug) {
    return NextResponse.json(
      { error: "title and slug are required" },
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
    const [newCollection] = await db
      .insert(collections)
      .values({
        workspaceId: workspace.id,
        title,
        description,
        slug,
      })
      .returning();

    return NextResponse.json(newCollection, { status: 201 });
  } catch (error) {
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json(
        { error: "A collection with this slug already exists in this workspace" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create collection" },
      { status: 500 }
    );
  }
}
