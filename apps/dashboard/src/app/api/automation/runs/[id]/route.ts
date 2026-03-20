import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const run = await db.query.automationRuns.findFirst({
      where: eq(automationRuns.id, id),
      with: { trigger: true, workspace: true },
    });

    if (!run) {
      throw new AppError("Run not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(
      session,
      run.workspaceId,
      PERMISSIONS.CONTENT_READ
    );

    const { trigger, workspace: _workspace, ...runData } = run;

    return NextResponse.json({
      ...runData,
      triggerName: trigger?.name ?? null,
    });
  })(_request);
}
