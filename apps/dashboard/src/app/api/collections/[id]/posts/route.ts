import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionPosts } from "@sessionforge/db";
import { eq, and, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getAuthorizedCollection(id: string, userId: string) {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, id),
  });
  if (!collection) return null;

  const workspace = await db.query.workspaces.findFirst({
    where: (workspaces, { eq }) => eq(workspaces.id, collection.workspaceId),
  });
  if (!workspace || workspace.ownerId !== userId) return null;

  return collection;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await getAuthorizedCollection(id, session.user.id);
  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const rows = await db.query.collectionPosts.findMany({
    where: eq(collectionPosts.collectionId, id),
    orderBy: [asc(collectionPosts.orderIndex)],
    with: { post: true },
  });

  const posts = rows.filter((r) => r.post !== null).map((r) => r.post);
  return NextResponse.json({ posts });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await getAuthorizedCollection(id, session.user.id);
  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const body = await request.json();
  const { postId } = body;
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  try {
    const [row] = await db
      .insert(collectionPosts)
      .values({ collectionId: id, postId })
      .onConflictDoNothing()
      .returning();
    return NextResponse.json(row ?? { collectionId: id, postId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add post" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await getAuthorizedCollection(id, session.user.id);
  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  try {
    await db
      .delete(collectionPosts)
      .where(and(eq(collectionPosts.collectionId, id), eq(collectionPosts.postId, postId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove post" },
      { status: 500 }
    );
  }
}
