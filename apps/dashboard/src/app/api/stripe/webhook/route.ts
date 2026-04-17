import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import type { PlanTier } from "@/lib/billing/plans";
import { ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

// Next.js Pages Router body-parser opt-out (no-op in the App Router).
export const config = { api: { bodyParser: false } };

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "incomplete_expired";

/** Maps a Stripe price ID to the corresponding plan tier. */
function planTierFromPriceId(priceId: string): PlanTier {
  const ids = STRIPE_PRICE_IDS;
  if (priceId === ids.solo_monthly || priceId === ids.solo_annual) return "solo";
  if (priceId === ids.pro_monthly || priceId === ids.pro_annual) return "pro";
  if (priceId === ids.team_monthly || priceId === ids.team_annual) return "team";
  return "free";
}

/**
 * Coerces a raw Stripe subscription status string to a value accepted by our
 * DB enum, defaulting to "active" for unrecognised statuses (e.g. "paused").
 */
function coerceStatus(raw: string): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = [
    "active",
    "canceled",
    "past_due",
    "trialing",
    "incomplete",
    "incomplete_expired",
  ];
  return (allowed as string[]).includes(raw)
    ? (raw as SubscriptionStatus)
    : "active";
}

/** Extracts the string ID from a Stripe expandable field. */
function expandableId(field: string | { id: string } | null | undefined): string | undefined {
  if (!field) return undefined;
  return typeof field === "string" ? field : field.id;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error(
      JSON.stringify({
        level: "warn",
        timestamp: new Date().toISOString(),
        source: "stripe.webhook",
        error: "Missing stripe-signature header",
      }),
    );
    return NextResponse.json(
      { error: "Missing stripe-signature header", code: ERROR_CODES.BAD_REQUEST },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: "warn",
        timestamp: new Date().toISOString(),
        source: "stripe.webhook",
        error: `Webhook signature verification failed: ${message}`,
      }),
    );
    return NextResponse.json(
      {
        error: `Webhook signature verification failed: ${message}`,
        code: ERROR_CODES.BAD_REQUEST,
      },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = expandableId(session.customer);
      const subscriptionId = expandableId(session.subscription);

      if (!customerId || !subscriptionId) break;

      // Retrieve the full subscription to obtain price and billing period details.
      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = stripeSub.items.data[0]?.price.id ?? "";
      const planTier = planTierFromPriceId(priceId);
      const currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
      const currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);

      await db
        .update(subscriptions)
        .set({
          stripeSubscriptionId: subscriptionId,
          planTier,
          currentPeriodStart,
          currentPeriodEnd,
          status: "active",
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));
      break;
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const customerId = expandableId(stripeSub.customer);

      if (!customerId) break;

      const priceId = stripeSub.items.data[0]?.price.id ?? "";
      const planTier = planTierFromPriceId(priceId);
      const currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
      const currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);

      await db
        .update(subscriptions)
        .set({
          planTier,
          currentPeriodStart,
          currentPeriodEnd,
          status: coerceStatus(stripeSub.status),
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const customerId = expandableId(stripeSub.customer);

      if (!customerId) break;

      await db
        .update(subscriptions)
        .set({
          planTier: "free",
          status: "canceled",
          stripeSubscriptionId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt and move on.
      break;
  }

  return NextResponse.json({ received: true });
}
