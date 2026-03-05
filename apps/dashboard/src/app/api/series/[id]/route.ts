import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { series } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const seriesItem = await db.query.series.findFirst({
    where: eq(series.id, id),
  });

  if (!seriesItem) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: (workspaces, { eq }) => eq(workspaces.id, seriesItem.workspaceId),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  return NextResponse.json(seriesItem);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const seriesItem = await db.query.series.findFirst({
    where: eq(series.id, id),
  });

  if (!seriesItem) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: (workspaces, { eq }) => eq(workspaces.id, seriesItem.workspaceId),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, slug, description, collectionId, orderIndex } = body;

  try {
    const [updated] = await db
      .update(series)
      .set({
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(collectionId !== undefined && { collectionId }),
        ...(orderIndex !== undefined && { orderIndex }),
      })
      .where(eq(series.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update series" },
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

  const seriesItem = await db.query.series.findFirst({
    where: eq(series.id, id),
  });

  if (!seriesItem) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: (workspaces, { eq }) => eq(workspaces.id, seriesItem.workspaceId),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  try {
    await db.delete(series).where(eq(series.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete series" },
      { status: 500 }
    );
  }
}
