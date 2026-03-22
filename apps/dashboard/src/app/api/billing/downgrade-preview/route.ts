import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { getUserSubscription, getCurrentMonthUsage } from "@/lib/billing/usage";
import {
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS,
  getPlanForTier,
  formatLimit,
} from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

/** Ordered tiers from lowest to highest value. */
const TIER_ORDER: PlanTier[] = ["free", "solo", "pro", "team"];

function tierIndex(tier: PlanTier): number {
  return TIER_ORDER.indexOf(tier);
}

/**
 * GET /api/billing/downgrade-preview?to={tier}
 *
 * Returns a preview of the impact of downgrading to a lower tier:
 * - Feature differences between current and target tier
 * - Effective date of the downgrade
 * - Current usage vs new tier limits (highlighting items over new limits)
 * - Pricing change summary
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetTier = req.nextUrl.searchParams.get("to") as PlanTier | null;

  if (!targetTier || !PLANS[targetTier]) {
    return NextResponse.json(
      { error: "Valid 'to' query parameter is required (free, solo, pro, team)" },
      { status: 400 }
    );
  }

  const subscription = await getUserSubscription(session.user.id);
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

  const currentPlan = getPlanForTier(currentTier);
  const targetPlan = getPlanForTier(targetTier);

  // ── Effective date ──────────────────────────────────────────────────────
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

  // ── Feature differences ─────────────────────────────────────────────────
  const currentFeatures = PLAN_FEATURES[currentTier];
  const targetFeatures = PLAN_FEATURES[targetTier];

  const featuresLost = currentFeatures
    .filter((feature) => {
      if (!feature.included) return false;
      const targetEquivalent = targetFeatures.find(
        (f) =>
          f.label === feature.label ||
          f.label.includes(feature.label.split(" ")[0])
      );
      return !targetEquivalent || !targetEquivalent.included;
    })
    .map((f) => f.label);

  const featuresKept = targetFeatures
    .filter((f) => f.included)
    .map((f) => f.label);

  // ── Usage vs new limits ─────────────────────────────────────────────────
  const [usage, workspaceRows] = await Promise.all([
    getCurrentMonthUsage(session.user.id),
    db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id)),
  ]);

  const targetLimits = PLAN_LIMITS[targetTier];
  const workspaceCount = workspaceRows.length;

  const usageImpact: Array<{
    metric: string;
    current: number;
    newLimit: string;
    overLimit: boolean;
  }> = [];

  // Workspace count check
  usageImpact.push({
    metric: "Workspaces",
    current: workspaceCount,
    newLimit: formatLimit(targetLimits.workspaces),
    overLimit:
      targetLimits.workspaces !== null &&
      workspaceCount > targetLimits.workspaces,
  });

  // Monthly usage checks
  const sessionScans = usage?.sessionScans ?? 0;
  usageImpact.push({
    metric: "Session scans this month",
    current: sessionScans,
    newLimit: formatLimit(targetLimits.sessionScansPerMonth),
    overLimit:
      targetLimits.sessionScansPerMonth !== null &&
      sessionScans > targetLimits.sessionScansPerMonth,
  });

  const insightExtractions = usage?.insightExtractions ?? 0;
  usageImpact.push({
    metric: "Insight extractions this month",
    current: insightExtractions,
    newLimit: formatLimit(targetLimits.insightExtractionsPerMonth),
    overLimit:
      targetLimits.insightExtractionsPerMonth !== null &&
      insightExtractions > targetLimits.insightExtractionsPerMonth,
  });

  const contentGenerations = usage?.contentGenerations ?? 0;
  usageImpact.push({
    metric: "Content generations this month",
    current: contentGenerations,
    newLimit: formatLimit(targetLimits.contentGenerationsPerMonth),
    overLimit:
      targetLimits.contentGenerationsPerMonth !== null &&
      contentGenerations > targetLimits.contentGenerationsPerMonth,
  });

  // ── Pricing change ──────────────────────────────────────────────────────
  const pricingChange = {
    current: {
      monthly: currentPlan.pricing.monthly,
      annual: currentPlan.pricing.annual,
    },
    target: {
      monthly: targetPlan.pricing.monthly,
      annual: targetPlan.pricing.annual,
    },
    savingsMonthly: currentPlan.pricing.monthly - targetPlan.pricing.monthly,
    savingsAnnual: currentPlan.pricing.annual - targetPlan.pricing.annual,
  };

  return NextResponse.json({
    currentPlan: {
      tier: currentTier,
      name: currentPlan.name,
    },
    targetPlan: {
      tier: targetTier,
      name: targetPlan.name,
    },
    effectiveDate,
    featuresLost,
    featuresKept,
    usageImpact,
    pricingChange,
  });
}
