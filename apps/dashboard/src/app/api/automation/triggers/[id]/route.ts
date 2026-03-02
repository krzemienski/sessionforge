import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import {
  createTriggerSchedule,
  deleteTriggerSchedule,
} from "@/lib/qstash";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const trigger = await db.query.contentTriggers.findFirst({
    where: eq(contentTriggers.id, id),
    with: { workspace: true },
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  if (trigger.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(trigger);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.contentTriggers.findFirst({
    where: eq(contentTriggers.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, triggerType, contentType, lookbackWindow, cronExpression, enabled } = body;

  const willBeEnabled = enabled !== undefined ? enabled : existing.enabled;
  const effectiveCron =
    cronExpression !== undefined ? cronExpression : existing.cronExpression;

  let qstashScheduleId: string | null = existing.qstashScheduleId ?? null;

  if (!willBeEnabled) {
    // Disabling: tear down any existing QStash schedule
    if (existing.qstashScheduleId) {
      await deleteTriggerSchedule(existing.qstashScheduleId);
      qstashScheduleId = null;
    }
  } else if (willBeEnabled && effectiveCron) {
    // Enabling or updating: recreate schedule when something relevant changed
    const cronChanged =
      cronExpression !== undefined &&
      cronExpression !== existing.cronExpression;
    const justEnabled = enabled === true && !existing.enabled;
    const noScheduleYet = !existing.qstashScheduleId;

    if (cronChanged || justEnabled || noScheduleYet) {
      if (existing.qstashScheduleId) {
        await deleteTriggerSchedule(existing.qstashScheduleId);
      }
      qstashScheduleId = await createTriggerSchedule(id, effectiveCron);
    }
  }

  const [updated] = await db
    .update(contentTriggers)
    .set({
      ...(name !== undefined && { name }),
      ...(triggerType !== undefined && { triggerType }),
      ...(contentType !== undefined && { contentType }),
      ...(lookbackWindow !== undefined && { lookbackWindow }),
      ...(cronExpression !== undefined && { cronExpression }),
      ...(enabled !== undefined && { enabled }),
      qstashScheduleId,
    })
    .where(eq(contentTriggers.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.contentTriggers.findFirst({
    where: eq(contentTriggers.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.qstashScheduleId) {
    await deleteTriggerSchedule(existing.qstashScheduleId);
  }

  await db.delete(contentTriggers).where(eq(contentTriggers.id, id));

  return NextResponse.json({ deleted: true });
}
