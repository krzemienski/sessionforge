import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getUserSubscription, getCurrentMonthUsage } from "@/lib/billing/usage";
import { PLAN_LIMITS, PLAN_FEATURES, getPlanForTier } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/cancel-preview
 *
 * Returns a preview of the impact of cancelling the current subscription:
 * - Effective cancellation date (end of current billing period)
 * - Features that will be lost when downgrading to free tier
 * - Data retention timeline
 * - Current usage that exceeds free-tier limits
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await getUserSubscription(session.user.id);
  const planTier = subscription.planTier as PlanTier;

  if (planTier === "free") {
    return NextResponse.json(
      { error: "No active paid subscription to cancel" },
      { status: 400 }
    );
  }

  // Determine effective cancellation date from Stripe or local data
  let effectiveDate: string | null = null;

  if (subscription.stripeSubscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );
      effectiveDate = new Date(
        stripeSub.current_period_end * 1000
      ).toISOString();
    } catch {
      // Fall back to local data if Stripe is unavailable
    }
  }

  if (!effectiveDate && subscription.currentPeriodEnd) {
    effectiveDate = new Date(subscription.currentPeriodEnd).toISOString();
  }

  if (!effectiveDate) {
    // Default to end of current month if no period info is available
    const now = new Date();
    effectiveDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    ).toISOString();
  }

  // Identify features that will be lost when downgrading to free
  const currentPlan = getPlanForTier(planTier);
  const currentFeatures = PLAN_FEATURES[planTier];
  const freeFeatures = PLAN_FEATURES.free;

  const featuresLost = currentFeatures
    .filter((feature) => {
      const freeEquivalent = freeFeatures.find(
        (f) => f.label === feature.label || f.label.includes(feature.label.split(" ")[0])
      );
      return feature.included && (!freeEquivalent || !freeEquivalent.included);
    })
    .map((f) => f.label);

  // Check current usage against free-tier limits
  const usage = await getCurrentMonthUsage(session.user.id);
  const freeLimits = PLAN_LIMITS.free;

  const usageExceeding: Array<{
    metric: string;
    current: number;
    freeLimit: number | null;
  }> = [];

  if (usage) {
    if (
      freeLimits.sessionScansPerMonth !== null &&
      usage.sessionScans > freeLimits.sessionScansPerMonth
    ) {
      usageExceeding.push({
        metric: "Session scans",
        current: usage.sessionScans,
        freeLimit: freeLimits.sessionScansPerMonth,
      });
    }

    if (
      freeLimits.insightExtractionsPerMonth !== null &&
      usage.insightExtractions > freeLimits.insightExtractionsPerMonth
    ) {
      usageExceeding.push({
        metric: "Insight extractions",
        current: usage.insightExtractions,
        freeLimit: freeLimits.insightExtractionsPerMonth,
      });
    }

    if (
      freeLimits.contentGenerationsPerMonth !== null &&
      usage.contentGenerations > freeLimits.contentGenerationsPerMonth
    ) {
      usageExceeding.push({
        metric: "Content generations",
        current: usage.contentGenerations,
        freeLimit: freeLimits.contentGenerationsPerMonth,
      });
    }

    if (
      freeLimits.workspaces !== null
    ) {
      // Workspace count would need a separate query; include the limit info
      usageExceeding.push({
        metric: "Workspaces",
        current: 0, // Would require workspace count query
        freeLimit: freeLimits.workspaces,
      });
    }
  }

  return NextResponse.json({
    currentPlan: {
      tier: planTier,
      name: currentPlan.name,
    },
    effectiveDate,
    featuresLost,
    dataRetention: {
      description:
        "Your data will be retained for 30 days after cancellation. After that, data beyond free-tier limits may be archived.",
      retentionDays: 30,
    },
    usageExceeding,
  });
}
