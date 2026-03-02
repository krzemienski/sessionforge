import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
