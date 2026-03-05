import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTemplates, workspaces } from "@sessionforge/db";
import { eq, or, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspaceSlug");

  if (!workspaceSlug) {
    return NextResponse.json(
      { error: "workspaceSlug query param required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Fetch both built-in templates (workspaceId is null) and workspace-specific templates
  const templates = await db.query.contentTemplates.findMany({
    where: or(
      isNull(contentTemplates.workspaceId),
      eq(contentTemplates.workspaceId, workspace.id)
    ),
    with: {
      creator: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      workspace: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    workspaceSlug,
    name,
    slug,
    contentType,
    description,
    structure,
    toneGuidance,
    exampleContent,
  } = body;

  if (!workspaceSlug || !name || !slug || !contentType) {
    return NextResponse.json(
      { error: "workspaceSlug, name, slug, and contentType are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Create a custom template for the workspace
  const [template] = await db
    .insert(contentTemplates)
    .values({
      workspaceId: workspace.id,
      name,
      slug,
      templateType: "custom",
      contentType,
      description: description || null,
      structure: structure || null,
      toneGuidance: toneGuidance || null,
      exampleContent: exampleContent || null,
      createdBy: session.user.id,
      isActive: true,
      usageCount: 0,
    })
    .returning();

  return NextResponse.json({ template }, { status: 201 });
}
