import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { triggerId } = body;

  if (!triggerId) {
    return NextResponse.json({ error: "triggerId is required" }, { status: 400 });
  }

  const trigger = await db.query.contentTriggers.findFirst({
    where: eq(contentTriggers.id, triggerId),
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  if (!trigger.enabled) {
    return NextResponse.json({ error: "Trigger is disabled" }, { status: 400 });
  }

  try {
    await db
      .update(contentTriggers)
      .set({ lastRunAt: new Date(), lastRunStatus: "running" })
      .where(eq(contentTriggers.id, triggerId));

    // Auto-scan step: discover new session files before content generation pipeline
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id))
      .limit(1);

    if (workspace.length) {
      const ws = workspace[0];
      const basePath = ws.sessionBasePath ?? "~/.claude";
      const scanStartTime = new Date();

      const isIncremental = ws.lastScanAt != null;
      const sinceTimestamp = isIncremental ? (ws.lastScanAt ?? undefined) : undefined;

      const files = await scanSessionFiles(30, basePath, sinceTimestamp);

      const normalized = await Promise.all(
        files.map(async (meta) => {
          const parsed = await parseSessionFile(meta.filePath);
          return normalizeSession(meta, parsed);
        })
      );

      await indexSessions(ws.id, normalized);

      await db
        .update(workspaces)
        .set({ lastScanAt: scanStartTime })
        .where(eq(workspaces.id, ws.id));
    }

    await db
      .update(contentTriggers)
      .set({ lastRunStatus: "success", lastRunAt: new Date() })
      .where(eq(contentTriggers.id, triggerId));

    return NextResponse.json({ executed: true });
  } catch (error) {
    await db
      .update(contentTriggers)
      .set({
        lastRunStatus: error instanceof Error ? error.message : "failed",
        lastRunAt: new Date(),
      })
      .where(eq(contentTriggers.id, triggerId));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution failed" },
      { status: 500 }
    );
  }
}
