import { db } from "@/lib/db";
import { webhookEndpoints } from "@sessionforge/db";
import { and, eq } from "drizzle-orm/sql";
import { deliverWebhook } from "./deliver";

export const WEBHOOK_EVENTS = [
  "content.generated",
  "content.published",
  "insight.extracted",
  "scan.completed",
  "automation.completed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export async function fireWebhookEvent(
  workspaceId: string,
  event: WebhookEvent,
  payload: object
): Promise<void> {
  try {
    const endpoints = await db.query.webhookEndpoints.findMany({
      where: and(
        eq(webhookEndpoints.workspaceId, workspaceId),
        eq(webhookEndpoints.enabled, true)
      ),
    });

    const matching = endpoints.filter((ep) => ep.events?.includes(event));

    await Promise.allSettled(
      matching.map((ep) => deliverWebhook(ep, event, payload))
    );
  } catch {
    // Errors should not propagate to callers
  }
}
