import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/cancel
 *
 * Cancels the user's Stripe subscription at the end of the current billing
 * period. The user retains access to paid features until the period ends.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
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

  if (subscription.planTier === "free") {
    return NextResponse.json(
      { error: "No active paid subscription to cancel" },
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
    // Cancel at period end so the user keeps access until the billing cycle ends
    const canceledSub = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    // Update local record to reflect the pending cancellation
    await db
      .update(subscriptions)
      .set({
        status: "canceled",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, session.user.id));

    return NextResponse.json({
      success: true,
      effectiveDate: new Date(
        canceledSub.current_period_end * 1000
      ).toISOString(),
      message:
        "Your subscription has been scheduled for cancellation. You will retain access to paid features until the end of your current billing period.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to cancel subscription. Please try again or contact support." },
      { status: 500 }
    );
  }
}
