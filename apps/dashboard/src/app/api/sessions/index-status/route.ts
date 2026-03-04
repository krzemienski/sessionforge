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
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { SessionMiner } from "@/lib/sessions/miner";

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

    const ws = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.slug, workspaceSlug),
          eq(workspaces.ownerId, session.user.id)
        )
      )
      .limit(1);

    if (!ws.length) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const miner = new SessionMiner(ws[0].id);
    const status = await miner.getIndexStatus();

    return NextResponse.json({
      totalSessions: status.totalSessions,
      totalDocuments: status.totalDocuments,
      lastBuilt: status.lastBuilt,
      indexSize: status.totalDocuments,
    });
  })(req);
}
