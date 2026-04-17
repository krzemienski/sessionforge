import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { requireApiKey, apiResponse, withV1ApiHandler } from "@/lib/api-auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { fireWebhookEvent } from "@/lib/webhooks/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withV1ApiHandler(async (req) => {
  const auth = await requireApiKey(req as NextRequest);

  const body = await req.json().catch(() => ({}));
  const rawLookback = (body as { lookbackDays?: unknown }).lookbackDays;

  let lookbackDays = 7;
  if (rawLookback !== undefined) {
    if (
      typeof rawLookback !== "number" ||
      !Number.isFinite(rawLookback) ||
      rawLookback < 1 ||
      rawLookback > 365
    ) {
      throw new AppError(
        "lookbackDays must be a number between 1 and 365",
        ERROR_CODES.VALIDATION_ERROR,
      );
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
    throw new AppError("No workspace found", ERROR_CODES.NOT_FOUND);
  }

  const ws = workspace[0];
  const basePath = ws.sessionBasePath ?? "~/.claude";

  const files = await scanSessionFiles(lookbackDays, basePath);

  const normalized = await Promise.all(
    files.map(async (meta) => {
      const parsed = await parseSessionFile(meta.filePath);
      return normalizeSession(meta, parsed);
    }),
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
});
