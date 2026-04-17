import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { authenticateApiKey, apiResponse, apiError } from "@/lib/api-auth";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { fireWebhookEvent } from "@/lib/webhooks/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const rawLookback = (body as { lookbackDays?: unknown }).lookbackDays;

  // Validate lookbackDays explicitly so callers can't accidentally launch a
  // full scan by POSTing an empty body. Default 7 days (was 30).
  let lookbackDays = 7;
  if (rawLookback !== undefined) {
    if (
      typeof rawLookback !== "number" ||
      !Number.isFinite(rawLookback) ||
      rawLookback < 1 ||
      rawLookback > 365
    ) {
      return apiError("lookbackDays must be a number between 1 and 365", 400);
    }
    lookbackDays = Math.floor(rawLookback);
  }

  const start = Date.now();

  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, auth.workspace.id))
    .limit(1);

  if (!workspace.length) {
    return apiError("No workspace found", 404);
  }

  const ws = workspace[0];
  const basePath = ws.sessionBasePath ?? "~/.claude";

  const files = await scanSessionFiles(lookbackDays, basePath);

  const normalized = await Promise.all(
    files.map(async (meta) => {
      const parsed = await parseSessionFile(meta.filePath);
      return normalizeSession(meta, parsed);
    })
  );

  const result = await indexSessions(ws.id, normalized);

  const durationMs = Date.now() - start;

  fireWebhookEvent(ws.id, "scan.completed", {
    scanned: result.scanned,
    indexed: result.indexed,
    errors: result.errors,
    durationMs,
  });

  return apiResponse({
    scanned: result.scanned,
    indexed: result.indexed,
    errors: result.errors,
    durationMs,
  });
}
