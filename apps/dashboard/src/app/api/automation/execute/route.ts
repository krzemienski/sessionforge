import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { verifyQStashRequest } from "@/lib/qstash";
import { runAutomationPipeline } from "@/lib/automation/pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();

  const isValid = await verifyQStashRequest(request, rawBody).catch(() => false);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { triggerId?: string };
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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution failed" },
      { status: 500 }
    );
  }
}
