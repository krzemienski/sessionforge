import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getUserSubscription } from "@/lib/billing/usage";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { usageEvents } from "@sessionforge/db";
import { eq, desc } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

/** Billing event types returned in the timeline. */
type BillingEventType =
  | "charge"
  | "refund"
  | "plan_change"
  | "subscription_created"
  | "subscription_canceled"
  | "upcoming_renewal"
  | "usage";

interface BillingEvent {
  id: string;
  type: BillingEventType;
  date: string;
  description: string;
  amountUsd: number | null;
  metadata: Record<string, string | number | null>;
}

/**
 * GET /api/billing/history
 *
 * Returns a chronologically-ordered timeline of billing events including
 * Stripe invoices, subscription changes, upcoming renewals, and local
 * usage summaries.
 *
 * Query params:
 *  - limit: max events to return (default 50, max 100)
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(1, Number(limitParam) || 50), 100);

  const subscription = await getUserSubscription(session.user.id);
  const events: BillingEvent[] = [];

  // ── Stripe-sourced events ───────────────────────────────────────────────
  if (subscription.stripeCustomerId) {
    try {
      // Fetch recent invoices from Stripe
      const invoices = await stripe.invoices.list({
        customer: subscription.stripeCustomerId,
        limit: 50,
        expand: ["data.charge"],
      });

      for (const invoice of invoices.data) {
        events.push({
          id: `inv_${invoice.id}`,
          type: invoice.amount_due < 0 ? "refund" : "charge",
          date: new Date((invoice.created ?? 0) * 1000).toISOString(),
          description: invoice.description || `Invoice ${invoice.number ?? invoice.id}`,
          amountUsd: (invoice.amount_paid ?? 0) / 100,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            status: invoice.status,
            pdfUrl: invoice.invoice_pdf,
          },
        });
      }

      // Fetch subscription events if user has a Stripe subscription
      if (subscription.stripeSubscriptionId) {
        const sub = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );

        // Subscription creation event
        events.push({
          id: `sub_created_${sub.id}`,
          type: "subscription_created",
          date: new Date(sub.created * 1000).toISOString(),
          description: `Subscription started (${subscription.planTier} plan)`,
          amountUsd: null,
          metadata: {
            subscriptionId: sub.id,
            planTier: subscription.planTier,
          },
        });

        // Subscription cancellation event (if applicable)
        if (sub.canceled_at) {
          events.push({
            id: `sub_canceled_${sub.id}`,
            type: "subscription_canceled",
            date: new Date(sub.canceled_at * 1000).toISOString(),
            description: `Subscription canceled (${subscription.planTier} plan)`,
            amountUsd: null,
            metadata: {
              subscriptionId: sub.id,
              planTier: subscription.planTier,
              cancelAtPeriodEnd: sub.cancel_at_period_end ? "true" : "false",
            },
          });
        }

        // Upcoming renewal event
        if (sub.status === "active" && sub.current_period_end) {
          events.push({
            id: `renewal_${sub.id}`,
            type: "upcoming_renewal",
            date: new Date(sub.current_period_end * 1000).toISOString(),
            description: `Upcoming renewal (${subscription.planTier} plan)`,
            amountUsd: sub.items.data[0]?.price?.unit_amount
              ? sub.items.data[0].price.unit_amount / 100
              : null,
            metadata: {
              subscriptionId: sub.id,
              planTier: subscription.planTier,
            },
          });
        }
      }
    } catch {
      // Stripe calls may fail with placeholder keys or network issues.
      // Gracefully continue with local data only.
    }
  }

  // ── Local usage events ──────────────────────────────────────────────────
  try {
    const recentUsage = await db
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.userId, session.user.id))
      .orderBy(desc(usageEvents.createdAt))
      .limit(limit);

    for (const event of recentUsage) {
      const label = event.eventType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      events.push({
        id: `usage_${event.id}`,
        type: "usage",
        date: event.createdAt?.toISOString() ?? new Date().toISOString(),
        description: label,
        amountUsd: event.costUsd ?? 0,
        metadata: {
          eventType: event.eventType,
          workspaceId: event.workspaceId,
        },
      });
    }
  } catch {
    // If usage table is unavailable, continue with Stripe events only.
  }

  // ── Sort chronologically (newest first) and apply limit ─────────────────
  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const trimmed = events.slice(0, limit);

  return NextResponse.json({
    events: trimmed,
    total: trimmed.length,
    planTier: subscription.planTier,
  });
}
