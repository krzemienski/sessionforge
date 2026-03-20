import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { styleSettings } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, workspaceStyleSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(session, slug);

    const rows = await db
      .select()
      .from(styleSettings)
      .where(eq(styleSettings.workspaceId, workspace.id))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({
        workspaceId: workspace.id,
        defaultTone: "technical",
        targetAudience: "senior engineers",
        customInstructions: null,
        includeCodeSnippets: true,
        includeTerminalOutput: true,
        maxBlogWordCount: 2500,
      });
    }

    return NextResponse.json(rows[0]);
  })(req);
}

export async function PUT(
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

    const wsId = workspace.id;
    const rawBody = await req.json().catch(() => ({}));
    const data = parseBody(workspaceStyleSchema, rawBody);

    // Build update object with only defined values to avoid overwriting with nulls
    const updateValues: Record<string, unknown> = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    const existing = await db
      .select({ id: styleSettings.id })
      .from(styleSettings)
      .where(eq(styleSettings.workspaceId, wsId))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(styleSettings)
        .set(updateValues)
        .where(eq(styleSettings.workspaceId, wsId))
        .returning();
    } else {
      [result] = await db
        .insert(styleSettings)
        .values({ workspaceId: wsId, ...updateValues })
        .returning();
    }

    return NextResponse.json(result);
  })(req);
}
