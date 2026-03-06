import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, sessionScanSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkQuota, recordUsage } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { workspaceSlug, lookbackDays, fullRescan } = parseBody(sessionScanSchema, rawBody);

    const scanStartTime = new Date();
    const start = Date.now();

    const workspace = workspaceSlug
      ? await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.slug, workspaceSlug))
          .limit(1)
      : await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.ownerId, session.user.id))
          .limit(1);

    if (!workspace.length) {
      throw new AppError("No workspace found", ERROR_CODES.NOT_FOUND);
    }

    const ws = workspace[0];

    const quotaCheck = await checkQuota(session.user.id, "session_scan");
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: "Quota exceeded", quotaInfo: quotaCheck, upgradeUrl: "/pricing" },
        { status: 402 }
      );
    }

    const basePath = ws.sessionBasePath ?? "~/.claude";

    // Incremental mode: use lastScanAt as cutoff unless fullRescan requested
    const isIncremental = !fullRescan && ws.lastScanAt != null;
    const sinceTimestamp = isIncremental ? (ws.lastScanAt ?? undefined) : undefined;

    const files = await scanSessionFiles(lookbackDays, basePath, sinceTimestamp);

    const normalized = await Promise.all(
      files.map(async (meta) => {
        const parsed = await parseSessionFile(meta.filePath);
        return normalizeSession(meta, parsed);
      })
    );

    const result = await indexSessions(ws.id, normalized);

    // Persist the scan start time so next incremental scan uses it as cutoff
    await db
      .update(workspaces)
      .set({ lastScanAt: scanStartTime })
      .where(eq(workspaces.id, ws.id));

    // Record usage for newly indexed sessions (single call, not N parallel)
    if (result.new > 0) {
      void recordUsage(session.user.id, ws.id, "session_scan", undefined, result.new);
    }

    return NextResponse.json({
      scanned: result.scanned,
      new: result.new,
      updated: result.updated,
      errors: result.errors,
      durationMs: Date.now() - start,
      isIncremental,
      lastScanAt: scanStartTime.toISOString(),
    });
  })(req);
}
