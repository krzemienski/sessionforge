import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const existing = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("API key not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, existing.workspaceId, PERMISSIONS.WORKSPACE_SETTINGS);

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    return NextResponse.json({ deleted: true });
  })(req);
}
