import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, triggerUpdateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  createTriggerSchedule,
  deleteTriggerSchedule,
} from "@/lib/qstash";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const trigger = await db.query.contentTriggers.findFirst({
      where: eq(contentTriggers.id, id),
      with: { workspace: true },
    });

    if (!trigger) {
      throw new AppError("Trigger not found", ERROR_CODES.NOT_FOUND);
    }

    if (trigger.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    return NextResponse.json(trigger);
  })(req);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const existing = await db.query.contentTriggers.findFirst({
      where: eq(contentTriggers.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Trigger not found", ERROR_CODES.NOT_FOUND);
    }

    if (existing.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    const rawBody = await req.json().catch(() => ({}));
    const { name, triggerType, contentType, lookbackWindow, cronExpression, enabled } =
      parseBody(triggerUpdateSchema, rawBody);

    const willBeEnabled = enabled !== undefined ? enabled : existing.enabled;
    const effectiveCron =
      cronExpression !== undefined ? cronExpression : existing.cronExpression;

    let qstashScheduleId: string | null = existing.qstashScheduleId ?? null;

    if (!willBeEnabled) {
      // Disabling: tear down any existing QStash schedule
      if (existing.qstashScheduleId) {
        try {
          await deleteTriggerSchedule(existing.qstashScheduleId);
        } catch {
          // QStash schedule already gone or API down - proceed with DB update
        }
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
          try {
            await deleteTriggerSchedule(existing.qstashScheduleId);
          } catch {
            // Proceed even if old schedule cleanup fails
          }
        }
        try {
          qstashScheduleId = await createTriggerSchedule(id, effectiveCron);
        } catch {
          qstashScheduleId = null;
        }
      }
    }

    const [updated] = await db
      .update(contentTriggers)
      .set({
        ...(name !== undefined && { name }),
        ...(triggerType !== undefined && {
          triggerType: triggerType as typeof contentTriggers.triggerType.enumValues[number],
        }),
        ...(contentType !== undefined && {
          contentType: contentType as typeof contentTriggers.contentType.enumValues[number],
        }),
        ...(lookbackWindow !== undefined && {
          lookbackWindow: lookbackWindow as typeof contentTriggers.lookbackWindow.enumValues[number],
        }),
        ...(cronExpression !== undefined && { cronExpression }),
        ...(enabled !== undefined && { enabled }),
        qstashScheduleId,
      })
      .where(eq(contentTriggers.id, id))
      .returning();

    return NextResponse.json(updated);
  })(req);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const existing = await db.query.contentTriggers.findFirst({
      where: eq(contentTriggers.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Trigger not found", ERROR_CODES.NOT_FOUND);
    }

    if (existing.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    if (existing.qstashScheduleId) {
      try {
        await deleteTriggerSchedule(existing.qstashScheduleId);
      } catch {
        // Schedule already gone or API down - proceed with DB deletion
      }
    }

    await db.delete(contentTriggers).where(eq(contentTriggers.id, id));

    return NextResponse.json({ deleted: true });
  })(req);
}
