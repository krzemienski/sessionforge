/**
 * GET /api/sessions/index-status?workspace=<slug>
 *
 * Returns the current state of the in-memory session search index
 * for the given workspace.
 *
 * Response: { totalSessions, totalDocuments, lastBuilt, indexSize }
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { SessionMiner } from "@/lib/sessions/miner";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.SESSIONS_READ
    );

    const miner = new SessionMiner(workspace.id);
    const status = await miner.getIndexStatus();

    return NextResponse.json({
      totalSessions: status.totalSessions,
      totalDocuments: status.totalDocuments,
      lastBuilt: status.lastBuilt,
      indexSize: status.totalDocuments,
    });
  })(req);
}
