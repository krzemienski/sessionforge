import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getUserSubscription, getCurrentMonthUsage } from "@/lib/billing/usage";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [subscription, usage] = await Promise.all([
    getUserSubscription(session.user.id),
    getCurrentMonthUsage(session.user.id),
  ]);

  const planTier = subscription.planTier as PlanTier;
  const limits = PLAN_LIMITS[planTier];

  const sessionScans = usage?.sessionScans ?? 0;
  const insightExtractions = usage?.insightExtractions ?? 0;
  const contentGenerations = usage?.contentGenerations ?? 0;
  const estimatedCostUsd = usage?.estimatedCostUsd ?? 0;

  function calcPercent(used: number, limit: number | null): number {
    if (limit === null) return 0;
    if (limit === 0) return 100;
    return Math.min(100, (used / limit) * 100);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const billingPeriodStart = new Date(year, month, 1).toISOString().split("T")[0];
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const billingPeriodEnd = lastDayOfMonth.toISOString().split("T")[0];

  const todayMidnight = new Date(year, month, now.getDate());
  const endMidnight = new Date(year, month + 1, 0);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilReset = Math.max(
    0,
    Math.ceil((endMidnight.getTime() - todayMidnight.getTime()) / msPerDay)
  );

  return NextResponse.json({
    planTier,
    planLimits: {
      sessionScansPerMonth: limits.sessionScansPerMonth,
      insightExtractionsPerMonth: limits.insightExtractionsPerMonth,
      contentGenerationsPerMonth: limits.contentGenerationsPerMonth,
    },
    currentUsage: {
      sessionScans,
      insightExtractions,
      contentGenerations,
    },
    percentUsed: {
      sessionScans: calcPercent(sessionScans, limits.sessionScansPerMonth),
      insightExtractions: calcPercent(insightExtractions, limits.insightExtractionsPerMonth),
      contentGenerations: calcPercent(contentGenerations, limits.contentGenerationsPerMonth),
    },
    estimatedCostUsd,
    billingPeriodStart,
    billingPeriodEnd,
    daysUntilReset,
  });
}
