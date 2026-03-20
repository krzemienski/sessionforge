import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approvalWorkflows } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, approvalSettingsSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { slug } = await params;

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    const rows = await db
      .select()
      .from(approvalWorkflows)
      .where(eq(approvalWorkflows.workspaceId, workspace.id))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({
        workspaceId: workspace.id,
        enabled: false,
        requiredApprovers: 1,
      });
    }

    return NextResponse.json(rows[0]);
  })(_req);
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
    const data = parseBody(approvalSettingsSchema, rawBody);

    // Build update object with only defined values to avoid overwriting with nulls
    const updateValues: Record<string, unknown> = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    const existing = await db
      .select({ id: approvalWorkflows.id })
      .from(approvalWorkflows)
      .where(eq(approvalWorkflows.workspaceId, wsId))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(approvalWorkflows)
        .set(updateValues)
        .where(eq(approvalWorkflows.workspaceId, wsId))
        .returning();
    } else {
      [result] = await db
        .insert(approvalWorkflows)
        .values({ workspaceId: wsId, ...updateValues })
        .returning();
    }

    return NextResponse.json(result);
  })(req);
}
