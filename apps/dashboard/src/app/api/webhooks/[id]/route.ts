import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Webhook endpoint not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { url, events, enabled } = body;

  const updates: {
    url?: string;
    events?: string[];
    enabled?: boolean;
  } = {};
  if (url !== undefined) updates.url = url;
  if (events !== undefined) updates.events = events;
  if (enabled !== undefined) updates.enabled = enabled;

  const [updated] = await db
    .update(webhookEndpoints)
    .set(updates)
    .where(eq(webhookEndpoints.id, id))
    .returning();

  return NextResponse.json({
    id: updated.id,
    url: updated.url,
    events: updated.events,
    enabled: updated.enabled,
    updatedAt: updated.updatedAt,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Webhook endpoint not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));

  return NextResponse.json({ deleted: true });
}
