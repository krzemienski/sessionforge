import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTemplates } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { getBuiltInTemplates } from "@/lib/templates";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

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

  try {
    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    // Fetch workspace-specific custom templates from the database
    let dbTemplates: Array<Record<string, unknown>> = [];
    try {
      dbTemplates = await db.query.contentTemplates.findMany({
        where: eq(contentTemplates.workspaceId, workspace.id),
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
    } catch (dbErr) {
      // Table may not exist in the live DB — return built-in templates only
      console.warn("[templates] DB query failed, returning built-in only:", dbErr);
    }

    // Merge built-in TypeScript templates (using slug as stable ID for agent lookups)
    const builtInTemplates = getBuiltInTemplates().map((t) => ({
      id: t.slug,
      workspaceId: null,
      name: t.name,
      slug: t.slug,
      templateType: "built_in" as const,
      contentType: t.contentType,
      description: t.description,
      structure: t.structure,
      toneGuidance: t.toneGuidance,
      exampleContent: t.exampleContent,
      isActive: true,
      createdBy: null,
      usageCount: 0,
      createdAt: null,
      updatedAt: null,
      creator: null,
      workspace: null,
    }));

    const templates = [...builtInTemplates, ...dbTemplates];
    return NextResponse.json({ templates });
  } catch (err) {
    // Re-throw AppError (from getAuthorizedWorkspace) so it returns proper status
    throw err;
  }
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

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.WORKSPACE_SETTINGS
  );

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
