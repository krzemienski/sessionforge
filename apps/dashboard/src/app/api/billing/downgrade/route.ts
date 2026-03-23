import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import type { PlanTier } from "@/lib/billing/plans";
import { PLANS } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

/** Ordered tiers from lowest to highest value. */
const TIER_ORDER: PlanTier[] = ["free", "solo", "pro", "team"];

function tierIndex(tier: PlanTier): number {
  return TIER_ORDER.indexOf(tier);
}

/**
 * Maps a target plan tier to its default monthly Stripe price ID.
 * Returns null for the free tier (handled by cancellation instead).
 */
function getPriceIdForTier(
  tier: PlanTier,
  interval: "monthly" | "annual" = "monthly"
): string | null {
  const key = `${tier}_${interval}` as keyof typeof STRIPE_PRICE_IDS;
  return STRIPE_PRICE_IDS[key] ?? null;
}

/**
 * POST /api/billing/downgrade
 *
 * Downgrades the user's subscription to a lower tier via Stripe.
 * For downgrades to free, cancels the subscription at period end.
 * For downgrades to a paid tier, swaps the Stripe subscription item.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { targetTier, interval } = body as {
    targetTier?: PlanTier;
    interval?: "monthly" | "annual";
  };

  if (!targetTier || !PLANS[targetTier]) {
    return NextResponse.json(
      { error: "Valid 'targetTier' is required (free, solo, pro, team)" },
      { status: 400 }
    );
  }

  const billingInterval = interval ?? "monthly";

  const rows = await db
    .select({
      id: subscriptions.id,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      planTier: subscriptions.planTier,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1);

  const subscription = rows[0];

  if (!subscription) {
    return NextResponse.json(
      { error: "No subscription found" },
      { status: 400 }
    );
  }

  const currentTier = subscription.planTier as PlanTier;

  if (currentTier === "free") {
    return NextResponse.json(
      { error: "No active paid subscription to downgrade" },
      { status: 400 }
    );
  }

  if (tierIndex(targetTier) >= tierIndex(currentTier)) {
    return NextResponse.json(
      { error: "Target tier must be lower than current tier" },
      { status: 400 }
    );
  }

  if (!subscription.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "No Stripe subscription linked to this account" },
      { status: 400 }
    );
  }

  if (subscription.status === "canceled") {
    return NextResponse.json(
      { error: "Subscription is already canceled" },
      { status: 400 }
    );
  }

  try {
    // Downgrade to free = cancel at period end
    if (targetTier === "free") {
      const canceledSub = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );

      await db
        .update(subscriptions)
        .set({
          status: "canceled",
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, session.user.id));

      return NextResponse.json({
        success: true,
        previousTier: currentTier,
        newTier: "free",
        effectiveDate: new Date(
          canceledSub.current_period_end * 1000
        ).toISOString(),
        message:
          "Your subscription will be downgraded to Free at the end of your current billing period.",
      });
    }

    // Downgrade to a lower paid tier — swap the subscription item's price
    const newPriceId = getPriceIdForTier(targetTier, billingInterval);

    if (!newPriceId) {
      return NextResponse.json(
        { error: "No price configured for the target tier" },
        { status: 500 }
      );
    }

    const stripeSub = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const currentItem = stripeSub.items.data[0];
    if (!currentItem) {
      return NextResponse.json(
        { error: "No subscription items found on current subscription" },
        { status: 500 }
      );
    }

    // Update subscription item with the new price, prorating at period end
    const updatedSub = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: currentItem.id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
      }
    );

    // Update local subscription record
    await db
      .update(subscriptions)
      .set({
        planTier: targetTier,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, session.user.id));

    return NextResponse.json({
      success: true,
      previousTier: currentTier,
      newTier: targetTier,
      effectiveDate: new Date(
        updatedSub.current_period_end * 1000
      ).toISOString(),
      message: `Your subscription has been downgraded to ${PLANS[targetTier].name}. Changes take effect immediately with prorated billing.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Failed to downgrade subscription. Please try again or contact support.",
      },
      { status: 500 }
    );
  }
}
