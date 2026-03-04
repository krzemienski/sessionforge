import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns, contentTriggers } from "@sessionforge/db";
import { and, eq, inArray } from "drizzle-orm/sql";
import { verifyQStashRequest } from "@/lib/qstash";
import { executePipeline } from "@/lib/automation/pipeline";
import {
  getSessionFingerprint,
  detectSessionChanges,
  shouldFirePipeline,
} from "@/lib/automation/file-watcher";

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
    with: { workspace: true },
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  if (!trigger.enabled || trigger.watchStatus === "paused") {
    return NextResponse.json({ skipped: true });
  }

  const basePath = trigger.workspace.sessionBasePath ?? "~/.claude";

  try {
    const currFingerprint = await getSessionFingerprint(basePath);
    const prevFingerprint = (trigger.fileWatchSnapshot as Record<string, number> | null) ?? {};

    const changes = detectSessionChanges(prevFingerprint, currFingerprint);

    if (changes.hasChanges) {
      await db
        .update(contentTriggers)
        .set({
          lastFileEventAt: new Date(),
          fileWatchSnapshot: currFingerprint,
          watchStatus: "watching",
        })
        .where(eq(contentTriggers.id, triggerId));
    }

    const updatedLastFileEventAt = changes.hasChanges
      ? new Date()
      : trigger.lastFileEventAt;

    const debounceMinutes = trigger.debounceMinutes ?? 30;

    if (!shouldFirePipeline(updatedLastFileEventAt, debounceMinutes)) {
      return NextResponse.json({
        polled: true,
        hasChanges: changes.hasChanges,
        fired: false,
      });
    }

    // Check for already-running pipeline
    const activeRun = await db.query.automationRuns.findFirst({
      where: and(
        eq(automationRuns.triggerId, triggerId),
        inArray(automationRuns.status, ["pending", "scanning", "extracting", "generating"])
      ),
    });

    if (activeRun) {
      return NextResponse.json({
        polled: true,
        hasChanges: changes.hasChanges,
        fired: false,
        reason: "Run already in progress",
      });
    }

    // Create run record and start pipeline
    const [newRun] = await db
      .insert(automationRuns)
      .values({
        triggerId,
        workspaceId: trigger.workspaceId,
        status: "pending",
      })
      .returning();

    executePipeline(newRun.id, trigger, trigger.workspace);

    return NextResponse.json({
      polled: true,
      hasChanges: changes.hasChanges,
      fired: true,
      runId: newRun.id,
    });
  } catch (error) {
    await db
      .update(contentTriggers)
      .set({ watchStatus: "error" })
      .where(eq(contentTriggers.id, triggerId));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "File watch poll failed" },
      { status: 500 }
    );
  }
}
