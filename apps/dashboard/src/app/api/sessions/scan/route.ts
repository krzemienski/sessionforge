import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, sessionScanSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { lookbackDays } = parseBody(sessionScanSchema, rawBody);

    const start = Date.now();

    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id))
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
      })
    );

    const result = await indexSessions(ws.id, normalized);

    return NextResponse.json({
      scanned: result.scanned,
      indexed: result.indexed,
      errors: result.errors,
      durationMs: Date.now() - start,
    });
  })(req);
}
