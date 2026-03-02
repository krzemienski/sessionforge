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
import { checkQuota, recordUsage } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lookbackDays: number = typeof body.lookbackDays === "number" ? body.lookbackDays : 30;

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

  // Enforce quota before performing the scan
  const quotaCheck = await checkQuota(session.user.id, "session_scan");
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      {
        error: "Quota exceeded",
        quotaInfo: quotaCheck,
        upgradeUrl: "/pricing",
      },
      { status: 402 }
    );
  }

  const basePath = ws.sessionBasePath ?? "~/.claude";

  const files = await scanSessionFiles(lookbackDays, basePath);

  const normalized = await Promise.all(
    files.map(async (meta) => {
      const parsed = await parseSessionFile(meta.filePath);
      return normalizeSession(meta, parsed);
    })
  );

  const result = await indexSessions(ws.id, normalized);

  // Record one usage event per newly indexed session
  if (result.indexed > 0) {
    await Promise.all(
      Array.from({ length: result.indexed }, () =>
        recordUsage(session.user.id, ws.id, "session_scan")
      )
    );
  }

  return NextResponse.json({
    scanned: result.scanned,
    indexed: result.indexed,
    errors: result.errors,
    durationMs: Date.now() - start,
  });
}
