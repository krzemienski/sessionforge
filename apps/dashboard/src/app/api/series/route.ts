import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { series, workspaces } from "@sessionforge/db";
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

  const results = await db.query.series.findMany({
    where: eq(series.workspaceId, workspace.id),
    orderBy: [desc(series.createdAt)],
    limit,
    offset,
  });

  return NextResponse.json({ series: results, limit, offset });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, name, slug, description, collectionId, orderIndex } = body;

  if (!workspaceSlug || !name || !slug) {
    return NextResponse.json(
      { error: "workspaceSlug, name, and slug are required" },
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
    const [created] = await db
      .insert(series)
      .values({
        workspaceId: workspace.id,
        name,
        slug,
        description,
        collectionId,
        orderIndex,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create series" },
      { status: 500 }
    );
  }
}
