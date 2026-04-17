/**
 * Cron-based automation runner.
 * Replaces QStash for scheduled trigger execution.
 *
 * In production: Vercel Cron hits this every 5 minutes.
 * In local dev: hit manually via curl or browser.
 *
 * Checks all enabled scheduled triggers, determines which are due
 * based on cronExpression + lastRunAt, and fires executePipeline().
 */

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import {
  automationRuns,
  contentTriggers,
  workspaces,
} from "@sessionforge/db";
import { and, eq, inArray } from "drizzle-orm/sql";
import { CronExpressionParser } from "cron-parser";
import { executePipeline } from "@/lib/automation/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isTriggerDue(cronExpression: string, lastRunAt: Date | null): boolean {
  try {
    if (!lastRunAt) return true; // never run → immediately due

    // Get the next occurrence after lastRunAt
    const cron = CronExpressionParser.parse(cronExpression, {
      currentDate: lastRunAt,
    });
    const nextDue = cron.next().toDate();
    return nextDue <= new Date();
  } catch {
    console.error(`[cron] Invalid cron expression: ${cronExpression}`);
    return false;
  }
}

export async function GET(request: Request) {
  // Verify cron secret. In production a missing CRON_SECRET is a misconfiguration
  // and the endpoint must refuse to run (fail-safe). In dev it is allowed but logged.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 503 },
      );
    }
    console.warn("[cron] CRON_SECRET not set — allowing in dev only");
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const triggers = await db.query.contentTriggers.findMany({
    where: and(
      eq(contentTriggers.enabled, true),
      eq(contentTriggers.triggerType, "scheduled"),
    ),
  });

  const results: { triggerId: string; name: string; status: string; runId?: string }[] = [];

  for (const trigger of triggers) {
    if (!trigger.cronExpression) {
      results.push({ triggerId: trigger.id, name: trigger.name, status: "skipped_no_cron" });
      continue;
    }

    if (!isTriggerDue(trigger.cronExpression, trigger.lastRunAt)) {
      results.push({ triggerId: trigger.id, name: trigger.name, status: "not_due" });
      continue;
    }

    // Check for already-running pipeline
    const activeRun = await db.query.automationRuns.findFirst({
      where: and(
        eq(automationRuns.triggerId, trigger.id),
        inArray(automationRuns.status, [
          "pending",
          "scanning",
          "extracting",
          "generating",
        ]),
      ),
    });

    if (activeRun) {
      results.push({ triggerId: trigger.id, name: trigger.name, status: "already_running", runId: activeRun.id });
      continue;
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, trigger.workspaceId),
    });

    if (!workspace) {
      results.push({ triggerId: trigger.id, name: trigger.name, status: "workspace_not_found" });
      continue;
    }

    // Create run and fire pipeline
    const [newRun] = await db
      .insert(automationRuns)
      .values({
        triggerId: trigger.id,
        workspaceId: workspace.id,
        status: "pending",
      })
      .returning();

    // Keep the lambda alive until the pipeline finishes. Without `after()`,
    // Vercel terminates the response handler as soon as `return NextResponse.json`
    // runs, silently truncating long-running pipelines. `after()` runs on the
    // Vercel runtime's post-response hook; in local/self-hosted runtimes it
    // falls back to running synchronously in-request.
    after(async () => {
      try {
        await executePipeline(newRun.id, trigger, workspace);
      } catch (err) {
        console.error(
          JSON.stringify({
            level: "error",
            timestamp: new Date().toISOString(),
            source: "cron.automation.executePipeline",
            runId: newRun.id,
            triggerId: trigger.id,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      }
    });

    results.push({ triggerId: trigger.id, name: trigger.name, status: "started", runId: newRun.id });
    console.log(`[cron] Started pipeline for trigger "${trigger.name}" (${trigger.id}), run ${newRun.id}`);
  }

  return NextResponse.json({
    checked: triggers.length,
    started: results.filter((r) => r.status === "started").length,
    results,
  });
}
