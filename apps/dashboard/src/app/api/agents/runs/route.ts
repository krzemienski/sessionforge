import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm/sql";
import { agentRuns } from "@sessionforge/db";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");
    const agentType = searchParams.get("agentType");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.VALIDATION_ERROR);
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_CREATE
    );

    const conditions = [eq(agentRuns.workspaceId, workspace.id)];
    if (agentType) {
      conditions.push(
        eq(agentRuns.agentType, agentType as typeof agentRuns.agentType.enumValues[number])
      );
    }

    const runs = await db
      .select()
      .from(agentRuns)
      .where(and(...conditions))
      .orderBy(desc(agentRuns.startedAt))
      .limit(limit);

    return NextResponse.json({ runs });
  })(request);
}
