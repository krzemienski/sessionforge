import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portfolioSettings } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";
import { parseBody } from "@/lib/validation";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Validation schema for PATCH updates
const portfolioSettingsUpdateSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  isEnabled: z.boolean().optional(),
  bio: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  socialLinks: z.record(z.string(), z.string()).optional().nullable(),
  pinnedPostIds: z.array(z.string()).optional().nullable(),
  theme: z.enum(["minimal", "developer-dark", "colorful"]).optional(),
  customDomain: z.string().optional().nullable(),
  showRss: z.boolean().optional(),
  showPoweredBy: z.boolean().optional(),
});

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.VALIDATION_ERROR);
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_READ
    );

    const settings = await db.query.portfolioSettings.findFirst({
      where: eq(portfolioSettings.workspaceId, workspace.id),
    });

    // Return default values if no settings exist yet
    if (!settings) {
      return NextResponse.json({
        workspaceId: workspace.id,
        isEnabled: false,
        bio: null,
        avatarUrl: null,
        socialLinks: null,
        pinnedPostIds: null,
        theme: "minimal",
        customDomain: null,
        showRss: true,
        showPoweredBy: true,
      });
    }

    return NextResponse.json(settings);
  })(request);
}

export async function PATCH(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const data = parseBody(portfolioSettingsUpdateSchema, rawBody);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      data.workspaceSlug,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    const wsId = workspace.id;

    // Build update object with only defined values to avoid overwriting with undefined
    const { workspaceSlug: _, ...updateData } = data;
    const updateValues: Record<string, unknown> = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    );

    const existing = await db.query.portfolioSettings.findFirst({
      where: eq(portfolioSettings.workspaceId, wsId),
    });

    let result;
    if (existing) {
      [result] = await db
        .update(portfolioSettings)
        .set(updateValues)
        .where(eq(portfolioSettings.workspaceId, wsId))
        .returning();
    } else {
      [result] = await db
        .insert(portfolioSettings)
        .values({ workspaceId: wsId, ...updateValues })
        .returning();
    }

    return NextResponse.json(result);
  })(req);
}
