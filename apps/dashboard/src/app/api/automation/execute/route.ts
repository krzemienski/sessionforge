import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, triggerExecuteSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const rawBody = await req.json().catch(() => ({}));
    const { triggerId } = parseBody(triggerExecuteSchema, rawBody);

    const trigger = await db.query.contentTriggers.findFirst({
      where: eq(contentTriggers.id, triggerId),
    });

    if (!trigger) {
      throw new AppError("Trigger not found", ERROR_CODES.NOT_FOUND);
    }

    if (!trigger.enabled) {
      throw new AppError("Trigger is disabled", ERROR_CODES.BAD_REQUEST);
    }

    try {
      await db
        .update(contentTriggers)
        .set({ lastRunAt: new Date(), lastRunStatus: "running" })
        .where(eq(contentTriggers.id, triggerId));

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

      throw new AppError(
        error instanceof Error ? error.message : "Execution failed",
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  })(req);
}
