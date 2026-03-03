import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, triggerExecuteSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verifyQStashRequest } from "@/lib/qstash";
import { runAutomationPipeline } from "@/lib/automation/pipeline";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Must read raw body as text first for QStash signature verification
  const rawBody = await request.text();

  const isValid = await verifyQStashRequest(request, rawBody).catch(() => false);
  if (!isValid) {
    return NextResponse.json(
      { error: "Unauthorized", code: ERROR_CODES.UNAUTHORIZED },
      { status: 401 }
    );
  }

  // Pre-parse the body so Zod validation can run inside withApiHandler
  const parsedBody = JSON.parse(rawBody) as unknown;

  return withApiHandler(async () => {
    const { triggerId } = parseBody(triggerExecuteSchema, parsedBody);

    const trigger = await db.query.contentTriggers.findFirst({
      where: eq(contentTriggers.id, triggerId),
    });

    if (!trigger) {
      throw new AppError("Trigger not found", ERROR_CODES.NOT_FOUND);
    }

    if (!trigger.enabled) {
      throw new AppError("Trigger is disabled", ERROR_CODES.BAD_REQUEST);
    }

    await db
      .update(contentTriggers)
      .set({ lastRunAt: new Date(), lastRunStatus: "running" })
      .where(eq(contentTriggers.id, triggerId));

    try {
      // Auto-scan step: run incremental scan before content generation pipeline
      // to ensure sessions are fresh when automation runs
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, trigger.workspaceId),
      });

      if (workspace) {
        const basePath = workspace.sessionBasePath ?? "~/.claude";
        const scanStartTime = new Date();
        const sinceTimestamp = workspace.lastScanAt ?? undefined;

        const files = await scanSessionFiles(30, basePath, sinceTimestamp);

        const normalized = await Promise.all(
          files.map(async (meta) => {
            const parsed = await parseSessionFile(meta.filePath);
            return normalizeSession(meta, parsed);
          })
        );

        await indexSessions(workspace.id, normalized);

        await db
          .update(workspaces)
          .set({ lastScanAt: scanStartTime })
          .where(eq(workspaces.id, workspace.id));
      }

      const result = await runAutomationPipeline({
        workspaceId: trigger.workspaceId,
        contentType: trigger.contentType,
        lookbackWindow: trigger.lookbackWindow ?? "last_7_days",
        triggerId,
      });

      await db
        .update(contentTriggers)
        .set({ lastRunStatus: "success", lastRunAt: new Date() })
        .where(eq(contentTriggers.id, triggerId));

      return NextResponse.json({ executed: true, ...result });
    } catch (error) {
      await db
        .update(contentTriggers)
        .set({ lastRunStatus: "failed", lastRunAt: new Date() })
        .where(eq(contentTriggers.id, triggerId));

      throw new AppError("Automation pipeline execution failed", ERROR_CODES.INTERNAL_ERROR);
    }
  })(request);
}
