import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { requireApiKey, apiResponse, withV1ApiHandler } from "@/lib/api-auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export const PATCH = withV1ApiHandler<RouteCtx>(async (req, ctx) => {
  const auth = await requireApiKey(req as NextRequest);

  const { id } = await ctx.params;
  const wsId = auth.workspace.id;

  const existing = await db.query.webhookEndpoints.findFirst({
    where: and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.workspaceId, wsId)),
  });

  if (!existing) {
    throw new AppError("Webhook endpoint not found", ERROR_CODES.NOT_FOUND);
  }

  let body: { url?: string; events?: string[]; enabled?: boolean };
  try {
    body = (await req.json()) as {
      url?: string;
      events?: string[];
      enabled?: boolean;
    };
  } catch {
    throw new AppError("Invalid JSON body", ERROR_CODES.BAD_REQUEST);
  }

  const { url, events, enabled } = body;

  if (events !== undefined && (!Array.isArray(events) || events.length === 0)) {
    throw new AppError(
      "events must be a non-empty array",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const updates: {
    url?: string;
    events?: string[];
    enabled?: boolean;
  } = {};

  if (url !== undefined) updates.url = url;
  if (events !== undefined) updates.events = events;
  if (enabled !== undefined) updates.enabled = enabled;

  if (Object.keys(updates).length === 0) {
    throw new AppError(
      "No valid fields to update",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const [updated] = await db
    .update(webhookEndpoints)
    .set(updates)
    .where(eq(webhookEndpoints.id, id))
    .returning();

  return apiResponse({
    id: updated.id,
    url: updated.url,
    events: updated.events,
    enabled: updated.enabled,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

export const DELETE = withV1ApiHandler<RouteCtx>(async (req, ctx) => {
  const auth = await requireApiKey(req as NextRequest);

  const { id } = await ctx.params;
  const wsId = auth.workspace.id;

  const existing = await db.query.webhookEndpoints.findFirst({
    where: and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.workspaceId, wsId)),
  });

  if (!existing) {
    throw new AppError("Webhook endpoint not found", ERROR_CODES.NOT_FOUND);
  }

  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));

  return apiResponse({ deleted: true });
});
