import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lookbackDays: number = typeof body.lookbackDays === "number" ? body.lookbackDays : 30;
  const fullRescan: boolean = body.fullRescan === true;

  const scanStartTime = new Date();
  const start = Date.now();

  // Get user's workspace
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id))
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const ws = workspace[0];
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

  return NextResponse.json({
    scanned: result.scanned,
    new: result.new,
    updated: result.updated,
    errors: result.errors,
    durationMs: Date.now() - start,
    isIncremental,
    lastScanAt: scanStartTime.toISOString(),
  });
}
