import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { authenticateApiKey, apiResponse, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiError("Unauthorized", 401);

  const { id } = await params;
  const wsId = auth.workspace.id;

  const existing = await db.query.webhookEndpoints.findFirst({
    where: and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.workspaceId, wsId)),
  });

  if (!existing) {
    return apiError("Webhook endpoint not found", 404);
  }

  let body: { url?: string; events?: string[]; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const { url, events, enabled } = body;

  if (events !== undefined && (!Array.isArray(events) || events.length === 0)) {
    return apiError("events must be a non-empty array", 400);
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
    return apiError("No valid fields to update", 400);
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
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiError("Unauthorized", 401);

  const { id } = await params;
  const wsId = auth.workspace.id;

  const existing = await db.query.webhookEndpoints.findFirst({
    where: and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.workspaceId, wsId)),
  });

  if (!existing) {
    return apiError("Webhook endpoint not found", 404);
  }

  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));

  return apiResponse({ deleted: true });
}
