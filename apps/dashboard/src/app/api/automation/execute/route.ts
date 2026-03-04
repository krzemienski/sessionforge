import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns, contentTriggers, workspaces } from "@sessionforge/db";
import { and, eq, inArray } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, triggerExecuteSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verifyQStashRequest } from "@/lib/qstash";
import { executePipeline } from "@/lib/automation/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Try QStash signature verification first (for scheduled triggers)
  const isQStash = await verifyQStashRequest(request, rawBody).catch(() => false);

  if (!isQStash) {
    // Fall back to session auth (for manual "Run Now" from UI)
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", code: ERROR_CODES.UNAUTHORIZED },
        { status: 401 }
      );
    }
  }

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

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, trigger.workspaceId),
    });

    if (!workspace) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    // Check for already-running pipeline
    const activeRun = await db.query.automationRuns.findFirst({
      where: and(
        eq(automationRuns.triggerId, triggerId),
        inArray(automationRuns.status, ["pending", "scanning", "extracting", "generating"])
      ),
    });

    if (activeRun) {
      return NextResponse.json(
        { error: "Run already in progress", runId: activeRun.id },
        { status: 409 }
      );
    }

    // Create run record and start pipeline asynchronously
    const [newRun] = await db
      .insert(automationRuns)
      .values({
        triggerId,
        workspaceId: workspace.id,
        status: "pending",
      })
      .returning();

    executePipeline(newRun.id, trigger, workspace);

    return NextResponse.json({ runId: newRun.id, status: "pending" }, { status: 202 });
  })(request);
}
