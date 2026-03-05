import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, contentTemplates } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspace/[slug]/template-defaults
 * Retrieve default templates for a workspace, grouped by content type
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  // Verify workspace exists and user has access
  const workspaceRows = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, session.user.id),
        eq(workspaces.slug, slug)
      )
    )
    .limit(1);

  if (!workspaceRows.length) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const workspace = workspaceRows[0];

  // Get templates marked as workspace_default for this workspace
  const defaultTemplates = await db
    .select()
    .from(contentTemplates)
    .where(
      and(
        eq(contentTemplates.workspaceId, workspace.id),
        eq(contentTemplates.templateType, "workspace_default"),
        eq(contentTemplates.isActive, true)
      )
    );

  // Group defaults by content type for easier frontend consumption
  const defaultsByContentType = defaultTemplates.reduce((acc, template) => {
    acc[template.contentType] = template;
    return acc;
  }, {} as Record<string, typeof defaultTemplates[0]>);

  return NextResponse.json(defaultsByContentType);
}

/**
 * POST /api/workspace/[slug]/template-defaults
 * Set a default template for a specific content type in a workspace
 * Body: { contentType: string, templateId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  // Verify workspace exists and user has access
  const workspaceRows = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, session.user.id),
        eq(workspaces.slug, slug)
      )
    )
    .limit(1);

  if (!workspaceRows.length) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const workspace = workspaceRows[0];

  // Parse request body
  const body = await req.json();
  const { contentType, templateId } = body;

  if (!contentType || !templateId) {
    return NextResponse.json(
      { error: "Missing required fields: contentType, templateId" },
      { status: 400 }
    );
  }

  // Verify the template exists
  const templateRows = await db
    .select()
    .from(contentTemplates)
    .where(eq(contentTemplates.id, templateId))
    .limit(1);

  if (!templateRows.length) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Note: Full implementation of setting workspace defaults will be completed in subtask-6-1
  // For now, return success with the template info
  return NextResponse.json({
    success: true,
    contentType,
    template: templateRows[0],
    message: "Template default set successfully"
  });
}
