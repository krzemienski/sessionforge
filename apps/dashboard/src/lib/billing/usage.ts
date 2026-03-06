/**
 * Usage metering helpers for quota enforcement and usage tracking.
 *
 * Provides four public functions:
 *  - getCurrentMonthUsage  – fetches the current calendar month's summary row
 *  - getUserSubscription   – fetches the subscription or falls back to free tier
 *  - checkQuota            – determines whether a user may perform an operation
 *  - recordUsage           – writes a usage event and upserts the monthly summary
 */

import { db } from "@/lib/db";
import {
  usageEvents,
  usageMonthlySummary,
  subscriptions,
} from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { PLAN_LIMITS } from "./plans";
import type { PlanTier } from "./plans";

// ── Types ──────────────────────────────────────────────────────────────────

export type UsageEventType =
  | "session_scan"
  | "insight_extraction"
  | "content_generation";

export type MonthlyUsageSummary = typeof usageMonthlySummary.$inferSelect;

export type SubscriptionRecord = typeof subscriptions.$inferSelect;

export interface QuotaCheck {
  allowed: boolean;
  /** Remaining operations allowed this month (Infinity when plan is unlimited). */
  remaining: number;
  /** Monthly cap (Infinity when plan is unlimited). */
  limit: number;
  /** Percentage of the limit already consumed (0–100). */
  percentUsed: number;
}

// ── Private helpers ────────────────────────────────────────────────────────

/** Returns the current calendar month as a "YYYY-MM" string. */
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns the monthly cap for `eventType` under `planTier`.
 * `null` indicates an unlimited plan.
 */
function getLimitForEventType(
  planTier: PlanTier,
  eventType: UsageEventType
): number | null {
  const limits = PLAN_LIMITS[planTier];
  switch (eventType) {
    case "session_scan":
      return limits.sessionScansPerMonth;
    case "insight_extraction":
      return limits.insightExtractionsPerMonth;
    case "content_generation":
      return limits.contentGenerationsPerMonth;
  }
}

/**
 * Returns the already-consumed count for `eventType` from a monthly summary
 * row.
 */
function getUsedCountForEventType(
  summary: Pick<
    MonthlyUsageSummary,
    "sessionScans" | "insightExtractions" | "contentGenerations"
  >,
  eventType: UsageEventType
): number {
  switch (eventType) {
    case "session_scan":
      return summary.sessionScans;
    case "insight_extraction":
      return summary.insightExtractions;
    case "content_generation":
      return summary.contentGenerations;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the current calendar month's usage summary for `userId`, or `null`
 * if no usage has been recorded yet this month.
 */
export async function getCurrentMonthUsage(
  userId: string
): Promise<MonthlyUsageSummary | null> {
  const month = currentMonthKey();

  const rows = await db
    .select()
    .from(usageMonthlySummary)
    .where(
      and(
        eq(usageMonthlySummary.userId, userId),
        eq(usageMonthlySummary.month, month)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Returns the user's active subscription row, or a synthetic free-tier record
 * if no subscription exists in the database.
 */
export async function getUserSubscription(
  userId: string
): Promise<SubscriptionRecord> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (rows.length > 0) {
    return rows[0];
  }

  // No subscription row yet – treat as an active free-tier user.
  return {
    id: "",
    userId,
    planTier: "free",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    status: "active",
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Checks whether `userId` is allowed to perform one more operation of
 * `eventType` under their current plan's monthly quota.
 */
export async function checkQuota(
  userId: string,
  eventType: UsageEventType
): Promise<QuotaCheck> {
  const [subscription, usage] = await Promise.all([
    getUserSubscription(userId),
    getCurrentMonthUsage(userId),
  ]);

  const limit = getLimitForEventType(
    subscription.planTier as PlanTier,
    eventType
  );

  // null means unlimited
  if (limit === null) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      percentUsed: 0,
    };
  }

  const used = usage ? getUsedCountForEventType(usage, eventType) : 0;
  const remaining = Math.max(0, limit - used);
  const percentUsed = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;

  return {
    allowed: remaining > 0,
    remaining,
    limit,
    percentUsed,
  };
}

/**
 * Records a usage event and upserts the monthly summary for the current
 * calendar month.
 *
 * Inserts one row into `usageEvents` then either increments the matching
 * counter in an existing `usageMonthlySummary` row or inserts a fresh one.
 */
export async function recordUsage(
  userId: string,
  workspaceId: string,
  eventType: UsageEventType,
  costUsd?: number,
  count: number = 1
): Promise<void> {
  const month = currentMonthKey();
  const cost = costUsd ?? 0;

  await db.insert(usageEvents).values({
    userId,
    workspaceId,
    eventType,
    costUsd: cost,
  });

  const sessionScansIncrement = eventType === "session_scan" ? count : 0;
  const insightExtractionsIncrement =
    eventType === "insight_extraction" ? count : 0;
  const contentGenerationsIncrement =
    eventType === "content_generation" ? count : 0;

  const existing = await db
    .select({
      id: usageMonthlySummary.id,
      sessionScans: usageMonthlySummary.sessionScans,
      insightExtractions: usageMonthlySummary.insightExtractions,
      contentGenerations: usageMonthlySummary.contentGenerations,
      estimatedCostUsd: usageMonthlySummary.estimatedCostUsd,
    })
    .from(usageMonthlySummary)
    .where(
      and(
        eq(usageMonthlySummary.userId, userId),
        eq(usageMonthlySummary.month, month)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    await db
      .update(usageMonthlySummary)
      .set({
        sessionScans: row.sessionScans + sessionScansIncrement,
        insightExtractions:
          row.insightExtractions + insightExtractionsIncrement,
        contentGenerations:
          row.contentGenerations + contentGenerationsIncrement,
        estimatedCostUsd: row.estimatedCostUsd + cost,
      })
      .where(eq(usageMonthlySummary.id, row.id));
  } else {
    await db.insert(usageMonthlySummary).values({
      userId,
      month,
      sessionScans: sessionScansIncrement,
      insightExtractions: insightExtractionsIncrement,
      contentGenerations: contentGenerationsIncrement,
      estimatedCostUsd: cost,
    });
  }
}
