import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { authenticateApiKey, apiResponse, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiError("Unauthorized", 401);

  const endpoints = await db.query.webhookEndpoints.findMany({
    where: eq(webhookEndpoints.workspaceId, auth.workspace.id),
    columns: {
      id: true,
      url: true,
      events: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiResponse(endpoints);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await req.json();
  const { url, events } = body as { url?: string; events?: string[] };

  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    return apiError("url and events (non-empty array) are required", 400);
  }

  const secret = randomBytes(32).toString("hex");

  const [endpoint] = await db
    .insert(webhookEndpoints)
    .values({
      workspaceId: auth.workspace.id,
      url,
      events,
      secret,
    })
    .returning();

  return apiResponse(
    {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      enabled: endpoint.enabled,
      secret,
      createdAt: endpoint.createdAt,
    },
    {},
    201
  );
}
