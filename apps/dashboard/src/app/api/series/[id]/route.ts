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
    with: {
      workspace: true,
      seriesPosts: {
        orderBy: (seriesPosts, { asc }) => [asc(seriesPosts.order)],
        with: {
          post: true,
        },
      },
    },
  });

  if (!seriesItem) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  if (seriesItem.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  // Verify ownership
  const existing = await db.query.series.findFirst({
    where: eq(series.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, slug, coverImage, isPublic } = body;

  try {
    const updates: Record<string, unknown> = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (slug !== undefined) updates.slug = slug;
    if (coverImage !== undefined) updates.coverImage = coverImage;
    if (isPublic !== undefined) updates.isPublic = isPublic;

    const [updated] = await db
      .update(series)
      .set(updates)
      .where(eq(series.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    // Handle unique constraint violation for slug
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json(
        { error: "A series with this slug already exists in this workspace" },
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

  const existing = await db.query.series.findFirst({
    where: eq(series.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(series).where(eq(series.id, id));

  return NextResponse.json({ deleted: true });
}
