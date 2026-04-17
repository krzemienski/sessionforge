import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { requireApiKey, apiResponse, withV1ApiHandler } from "@/lib/api-auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withV1ApiHandler(async (req) => {
  const auth = await requireApiKey(req as NextRequest);

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
});

export const POST = withV1ApiHandler(async (req) => {
  const auth = await requireApiKey(req as NextRequest);

  let body: { url?: string; events?: string[] };
  try {
    body = (await req.json()) as { url?: string; events?: string[] };
  } catch {
    throw new AppError("Invalid JSON body", ERROR_CODES.BAD_REQUEST);
  }

  const { url, events } = body;

  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    throw new AppError(
      "url and events (non-empty array) are required",
      ERROR_CODES.VALIDATION_ERROR,
    );
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
    201,
  );
});
