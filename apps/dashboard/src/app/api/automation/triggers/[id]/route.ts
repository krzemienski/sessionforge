import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTriggers } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, triggerUpdateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  createTriggerSchedule,
  createFileWatchSchedule,
  deleteTriggerSchedule,
} from "@/lib/qstash";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

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

    await getAuthorizedWorkspaceById(
      session,
      trigger.workspaceId,
      PERMISSIONS.CONTENT_READ
    );

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

    await getAuthorizedWorkspaceById(
      session,
      existing.workspaceId,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    const rawBody = await req.json().catch(() => ({}));
    const { name, triggerType, contentType, lookbackWindow, cronExpression, enabled, debounceMinutes } =
      parseBody(triggerUpdateSchema, rawBody);

    const willBeEnabled = enabled !== undefined ? enabled : existing.enabled;
    const effectiveCron =
      cronExpression !== undefined ? cronExpression : existing.cronExpression;
    const effectiveTriggerType =
      triggerType !== undefined ? triggerType : existing.triggerType;

    let qstashScheduleId: string | null = existing.qstashScheduleId ?? null;
    let watchStatus: string | null = existing.watchStatus ?? null;

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
      if (effectiveTriggerType === "file_watch") {
        watchStatus = "paused";
      }
    } else if (willBeEnabled && effectiveCron) {
      // Enabling or updating scheduled trigger
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
    } else if (willBeEnabled && effectiveTriggerType === "file_watch") {
      // Enabling file_watch trigger: create or restore the poll schedule
      const justEnabled = enabled === true && !existing.enabled;
      const noScheduleYet = !existing.qstashScheduleId;

      if (justEnabled || noScheduleYet) {
        if (existing.qstashScheduleId) {
          try {
            await deleteTriggerSchedule(existing.qstashScheduleId);
          } catch {
            // Proceed even if old schedule cleanup fails
          }
        }
        try {
          qstashScheduleId = await createFileWatchSchedule(id);
          watchStatus = "watching";
        } catch {
          qstashScheduleId = null;
        }
      }
    }

    type TriggerInsert = typeof contentTriggers.$inferInsert;
    const [updated] = await db
      .update(contentTriggers)
      .set({
        ...(name !== undefined && { name }),
        ...(triggerType !== undefined && { triggerType: triggerType as TriggerInsert["triggerType"] }),
        ...(contentType !== undefined && { contentType: contentType as TriggerInsert["contentType"] }),
        ...(lookbackWindow !== undefined && { lookbackWindow: lookbackWindow as TriggerInsert["lookbackWindow"] }),
        ...(cronExpression !== undefined && { cronExpression }),
        ...(enabled !== undefined && { enabled }),
        ...(debounceMinutes !== undefined && { debounceMinutes }),
        ...(effectiveTriggerType === "file_watch" && { watchStatus }),
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

    await getAuthorizedWorkspaceById(
      session,
      existing.workspaceId,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

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
