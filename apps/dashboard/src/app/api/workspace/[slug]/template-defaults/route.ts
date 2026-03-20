import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTemplates } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspace/[slug]/template-defaults
 * Retrieve default templates for a workspace, grouped by content type
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(session, slug);

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
  })(req);
}

/**
 * POST /api/workspace/[slug]/template-defaults
 * Set a default template for a specific content type in a workspace
 * Body: { contentType: string, templateId: string }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    // Parse request body
    const body = await req.json();
    const { contentType, templateId } = body;

    if (!contentType || !templateId) {
      throw new AppError(
        "Missing required fields: contentType, templateId",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Verify the template exists and belongs to this workspace
    const templateRows = await db
      .select()
      .from(contentTemplates)
      .where(
        and(
          eq(contentTemplates.id, templateId),
          eq(contentTemplates.workspaceId, workspace.id)
        )
      )
      .limit(1);

    if (!templateRows.length) {
      throw new AppError("Template not found", ERROR_CODES.NOT_FOUND);
    }

    const template = templateRows[0];

    // Verify the template's content type matches the requested content type
    if (template.contentType !== contentType) {
      throw new AppError(
        "Template content type does not match requested content type",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Clear any existing workspace_default for this content type
    await db
      .update(contentTemplates)
      .set({ templateType: "custom" })
      .where(
        and(
          eq(contentTemplates.workspaceId, workspace.id),
          eq(contentTemplates.contentType, contentType),
          eq(contentTemplates.templateType, "workspace_default")
        )
      );

    // Set the new template as workspace_default
    await db
      .update(contentTemplates)
      .set({ templateType: "workspace_default" })
      .where(eq(contentTemplates.id, templateId));

    return NextResponse.json({
      success: true,
      contentType,
      template: { ...template, templateType: "workspace_default" },
      message: "Template default set successfully"
    });
  })(req);
}
