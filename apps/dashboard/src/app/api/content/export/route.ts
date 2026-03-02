import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, workspaces } from "@sessionforge/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { buildExportZip } from "@/lib/export/markdown-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const contentType = searchParams.get("type");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

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
    conditions.push(
      eq(posts.contentType, contentType as typeof posts.contentType.enumValues[number])
    );
  }

  if (status) {
    conditions.push(
      eq(posts.status, status as typeof posts.status.enumValues[number])
    );
  }

  if (dateFrom) {
    conditions.push(gte(posts.createdAt, new Date(dateFrom)));
  }

  if (dateTo) {
    conditions.push(lte(posts.createdAt, new Date(dateTo)));
  }

  const results = await db.query.posts.findMany({
    where: and(...conditions),
    orderBy: [desc(posts.createdAt)],
  });

  try {
    const zipBuffer = await buildExportZip(results);

    const filename = `sessionforge-export-${new Date().toISOString().slice(0, 10)}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
