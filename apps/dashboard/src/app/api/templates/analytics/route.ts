import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTemplates } from "@sessionforge/db";
import { eq, or, isNull } from "drizzle-orm";
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

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.WORKSPACE_SETTINGS
  );

  // Fetch both built-in templates (workspaceId is null) and workspace-specific templates
  const templates = await db.query.contentTemplates.findMany({
    where: or(
      isNull(contentTemplates.workspaceId),
      eq(contentTemplates.workspaceId, workspace.id)
    ),
    orderBy: (templates, { desc }) => [desc(templates.usageCount)],
  });

  // Calculate analytics
  const totalTemplates = templates.length;
  const activeTemplates = templates.filter((t) => t.isActive).length;
  const totalUsage = templates.reduce((sum, t) => sum + (t.usageCount || 0), 0);

  const builtInTemplates = templates.filter((t) => t.templateType === "built_in");
  const customTemplates = templates.filter((t) => t.templateType === "custom");

  const mostUsedTemplates = templates
    .filter((t) => t.usageCount && t.usageCount > 0)
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      templateType: t.templateType,
      contentType: t.contentType,
      usageCount: t.usageCount,
      isActive: t.isActive,
    }));

  const templatesByContentType = templates.reduce((acc, t) => {
    const type = t.contentType;
    if (!acc[type]) {
      acc[type] = {
        count: 0,
        totalUsage: 0,
      };
    }
    acc[type].count++;
    acc[type].totalUsage += t.usageCount || 0;
    return acc;
  }, {} as Record<string, { count: number; totalUsage: number }>);

  const analytics = {
    summary: {
      totalTemplates,
      activeTemplates,
      inactiveTemplates: totalTemplates - activeTemplates,
      totalUsage,
      builtInCount: builtInTemplates.length,
      customCount: customTemplates.length,
    },
    mostUsedTemplates,
    byContentType: templatesByContentType,
  };

  return NextResponse.json({ analytics });
}
