import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, triggerExecuteSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verifyQStashRequest } from "@/lib/qstash";
import { runAutomationPipeline } from "@/lib/automation/pipeline";

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

      throw new AppError(
        error instanceof Error ? error.message : "Execution failed",
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  })(request);
}
