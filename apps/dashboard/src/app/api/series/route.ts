import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { series } from "@sessionforge/db";
import { eq, desc } from "drizzle-orm";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

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

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.CONTENT_READ
  );

  const results = await db.query.series.findMany({
    where: eq(series.workspaceId, workspace.id),
    orderBy: [desc(series.createdAt)],
    limit,
    offset,
    with: {
      seriesPosts: {
        with: {
          post: true,
        },
      },
    },
  });

  const seriesWithCounts = results.map((s) => ({
    ...s,
    postCount: s.seriesPosts.length,
  }));

  return NextResponse.json({ series: seriesWithCounts, limit, offset });
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
  const { title, description, slug, coverImage, isPublic } = body;

  if (!title || !slug) {
    return NextResponse.json(
      { error: "title and slug are required" },
      { status: 400 }
    );
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.CONTENT_CREATE
  );

  try {
    const [newSeries] = await db
      .insert(series)
      .values({
        workspaceId: workspace.id,
        title,
        description,
        slug,
        coverImage,
        isPublic: isPublic ?? false,
      })
      .returning();

    return NextResponse.json(newSeries, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json(
        { error: "A series with this slug already exists in this workspace" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create series" },
      { status: 500 }
    );
  }
}
