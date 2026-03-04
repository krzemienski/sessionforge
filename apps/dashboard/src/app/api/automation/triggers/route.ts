import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, triggerCreateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { createTriggerSchedule, createFileWatchSchedule } from "@/lib/qstash";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const triggers = await db.query.contentTriggers.findMany({
      where: eq(contentTriggers.workspaceId, workspace.id),
    });

    return NextResponse.json({ triggers });
  })(req);
}

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { workspaceSlug, name, triggerType, contentType, lookbackWindow, cronExpression, debounceMinutes } =
      parseBody(triggerCreateSchema, rawBody);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const [trigger] = await db
      .insert(contentTriggers)
      .values({
        workspaceId: workspace.id,
        name: name || "Untitled Schedule",
        triggerType: triggerType as typeof contentTriggers.triggerType.enumValues[number],
        contentType: contentType as typeof contentTriggers.contentType.enumValues[number],
        lookbackWindow: (lookbackWindow || "last_7_days") as typeof contentTriggers.lookbackWindow.enumValues[number],
        cronExpression: cronExpression || null,
        debounceMinutes: debounceMinutes ?? 30,
      })
      .returning();

    let qstashScheduleId: string | null = null;

    if (triggerType === "scheduled" && cronExpression) {
      try {
        qstashScheduleId = await createTriggerSchedule(trigger.id, cronExpression);

        const [updated] = await db
          .update(contentTriggers)
          .set({ qstashScheduleId })
          .where(eq(contentTriggers.id, trigger.id))
          .returning();

        return NextResponse.json(updated, { status: 201 });
      } catch {
        // QStash schedule creation failed — return trigger without scheduleId
      }
    }

    if (triggerType === "file_watch") {
      try {
        qstashScheduleId = await createFileWatchSchedule(trigger.id);

        const [updated] = await db
          .update(contentTriggers)
          .set({ qstashScheduleId, watchStatus: "watching" })
          .where(eq(contentTriggers.id, trigger.id))
          .returning();

        return NextResponse.json(updated, { status: 201 });
      } catch {
        // QStash schedule creation failed — return trigger without scheduleId
      }
    }

    return NextResponse.json(trigger, { status: 201 });
  })(req);
}
