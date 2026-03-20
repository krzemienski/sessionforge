/**
 * GET /api/observability/events
 *
 * Query historical observability events from the database.
 * Query params: workspace (slug), limit, offset, agentType, eventType, level, since
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentEvents } from "@sessionforge/db";
import { and, eq, gte, desc, type SQL } from "drizzle-orm/sql";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const workspaceSlug = params.get("workspace");
  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace required" }, { status: 400 });
  }

  const { workspace: ws } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.ANALYTICS_READ
  );

  const limit = Math.min(parseInt(params.get("limit") ?? "100", 10), 500);
  const offset = parseInt(params.get("offset") ?? "0", 10);

  const conditions: SQL[] = [eq(agentEvents.workspaceId, ws.id)];

  const agentType = params.get("agentType");
  if (agentType) {
    conditions.push(eq(agentEvents.agentType, agentType));
  }

  const eventType = params.get("eventType");
  if (eventType) {
    conditions.push(eq(agentEvents.eventType, eventType));
  }

  const level = params.get("level");
  if (level) {
    conditions.push(eq(agentEvents.level, level));
  }

  const since = params.get("since");
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      conditions.push(gte(agentEvents.createdAt, sinceDate));
    }
  }

  const rows = await db
    .select()
    .from(agentEvents)
    .where(and(...conditions))
    .orderBy(desc(agentEvents.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ events: rows, count: rows.length, limit, offset });
}
