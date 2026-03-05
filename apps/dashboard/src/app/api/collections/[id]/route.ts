import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, id),
    with: {
      workspace: true,
      collectionPosts: {
        orderBy: (collectionPosts, { asc }) => [asc(collectionPosts.order)],
        with: {
          post: true,
        },
      },
    },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (collection.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(collection);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const existing = await db.query.collections.findFirst({
    where: eq(collections.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, slug, coverImage, isPublic } = body;

  try {
    const [updated] = await db
      .update(collections)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(slug !== undefined && { slug }),
        ...(isPublic !== undefined && { isPublic }),
        ...(coverImage !== undefined && { coverImage }),
        updatedAt: new Date(),
      })
      .where(eq(collections.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json(
        { error: "A collection with this slug already exists in this workspace" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.collections.findFirst({
    where: eq(collections.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(collections).where(eq(collections.id, id));

  return NextResponse.json({ deleted: true });
}
