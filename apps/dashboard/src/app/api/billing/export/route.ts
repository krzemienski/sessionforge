import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getUserSubscription, getCurrentMonthUsage } from "@/lib/billing/usage";
import { PLAN_LIMITS, PLANS, formatLimit } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { usageEvents, workspaces, usageMonthlySummary } from "@sessionforge/db";
import { eq, desc } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

interface ComplianceReport {
  exportedAt: string;
  account: {
    userId: string;
    email: string;
    name: string | null;
  };
  currentPlan: {
    tier: string;
    name: string;
    status: string;
    pricing: {
      monthlyUsd: number;
      annualUsd: number;
    };
    limits: {
      sessionScansPerMonth: string;
      insightExtractionsPerMonth: string;
      contentGenerationsPerMonth: string;
      workspaces: string;
    };
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
  };
  currentUsage: {
    month: string;
    sessionScans: number;
    insightExtractions: number;
    contentGenerations: number;
    estimatedCostUsd: number;
  };
  billingHistory: {
    id: string;
    eventType: string;
    costUsd: number;
    createdAt: string;
    workspaceId: string | null;
  }[];
  workspaces: {
    id: string;
    name: string;
    slug: string;
    createdAt: string | null;
    lastScanAt: string | null;
  }[];
  dataRetention: {
    policy: string;
    usageEventsRetentionDays: number;
    accountDataRetentionDays: number;
    description: string;
  };
}

/**
 * GET /api/billing/export
 *
 * Generates a comprehensive compliance report containing billing history,
 * current plan details, usage summary, workspace info, and data retention
 * policy.
 *
 * Query params:
 *  - format: "json" (default) or "csv"
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format")?.toLowerCase() ?? "json";

  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { error: "Invalid format. Must be 'json' or 'csv'." },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // ── Gather all data in parallel ──────────────────────────────────────────
  const [subscription, usage, recentUsageEvents, userWorkspaces] =
    await Promise.all([
      getUserSubscription(userId),
      getCurrentMonthUsage(userId),
      db
        .select({
          id: usageEvents.id,
          eventType: usageEvents.eventType,
          costUsd: usageEvents.costUsd,
          createdAt: usageEvents.createdAt,
          workspaceId: usageEvents.workspaceId,
        })
        .from(usageEvents)
        .where(eq(usageEvents.userId, userId))
        .orderBy(desc(usageEvents.createdAt))
        .limit(500),
      db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          createdAt: workspaces.createdAt,
          lastScanAt: workspaces.lastScanAt,
        })
        .from(workspaces)
        .where(eq(workspaces.ownerId, userId)),
    ]);

  const planTier = subscription.planTier as PlanTier;
  const plan = PLANS[planTier];
  const limits = PLAN_LIMITS[planTier];

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const report: ComplianceReport = {
    exportedAt: now.toISOString(),
    account: {
      userId,
      email: session.user.email,
      name: session.user.name ?? null,
    },
    currentPlan: {
      tier: planTier,
      name: plan.name,
      status: subscription.status,
      pricing: {
        monthlyUsd: plan.pricing.monthly,
        annualUsd: plan.pricing.annual,
      },
      limits: {
        sessionScansPerMonth: formatLimit(limits.sessionScansPerMonth),
        insightExtractionsPerMonth: formatLimit(limits.insightExtractionsPerMonth),
        contentGenerationsPerMonth: formatLimit(limits.contentGenerationsPerMonth),
        workspaces: formatLimit(limits.workspaces),
      },
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      stripeCustomerId: subscription.stripeCustomerId ?? null,
    },
    currentUsage: {
      month: currentMonth,
      sessionScans: usage?.sessionScans ?? 0,
      insightExtractions: usage?.insightExtractions ?? 0,
      contentGenerations: usage?.contentGenerations ?? 0,
      estimatedCostUsd: usage?.estimatedCostUsd ?? 0,
    },
    billingHistory: recentUsageEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      costUsd: e.costUsd ?? 0,
      createdAt: e.createdAt?.toISOString() ?? now.toISOString(),
      workspaceId: e.workspaceId,
    })),
    workspaces: userWorkspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      createdAt: w.createdAt?.toISOString() ?? null,
      lastScanAt: w.lastScanAt?.toISOString() ?? null,
    })),
    dataRetention: {
      policy: "standard",
      usageEventsRetentionDays: 90,
      accountDataRetentionDays: 30,
      description:
        "Usage events are retained for 90 days. Account data is retained for 30 days after account deletion. All data is permanently deleted after the retention period.",
    },
  };

  // ── Return JSON ──────────────────────────────────────────────────────────
  if (format === "json") {
    return NextResponse.json(report);
  }

  // ── Return CSV ───────────────────────────────────────────────────────────
  const csvLines: string[] = [];

  // Section: Account
  csvLines.push("Section,Field,Value");
  csvLines.push(`Account,User ID,${csvEscape(report.account.userId)}`);
  csvLines.push(`Account,Email,${csvEscape(report.account.email)}`);
  csvLines.push(`Account,Name,${csvEscape(report.account.name ?? "")}`);
  csvLines.push(`Account,Exported At,${csvEscape(report.exportedAt)}`);

  // Section: Current Plan
  csvLines.push(`Plan,Tier,${csvEscape(report.currentPlan.tier)}`);
  csvLines.push(`Plan,Name,${csvEscape(report.currentPlan.name)}`);
  csvLines.push(`Plan,Status,${csvEscape(report.currentPlan.status)}`);
  csvLines.push(`Plan,Monthly Price (USD),${report.currentPlan.pricing.monthlyUsd}`);
  csvLines.push(`Plan,Annual Price (USD),${report.currentPlan.pricing.annualUsd}`);
  csvLines.push(`Plan,Session Scans Limit,${csvEscape(report.currentPlan.limits.sessionScansPerMonth)}`);
  csvLines.push(`Plan,Insight Extractions Limit,${csvEscape(report.currentPlan.limits.insightExtractionsPerMonth)}`);
  csvLines.push(`Plan,Content Generations Limit,${csvEscape(report.currentPlan.limits.contentGenerationsPerMonth)}`);
  csvLines.push(`Plan,Workspaces Limit,${csvEscape(report.currentPlan.limits.workspaces)}`);
  csvLines.push(`Plan,Period Start,${csvEscape(report.currentPlan.currentPeriodStart ?? "")}`);
  csvLines.push(`Plan,Period End,${csvEscape(report.currentPlan.currentPeriodEnd ?? "")}`);

  // Section: Current Usage
  csvLines.push(`Usage,Month,${csvEscape(report.currentUsage.month)}`);
  csvLines.push(`Usage,Session Scans,${report.currentUsage.sessionScans}`);
  csvLines.push(`Usage,Insight Extractions,${report.currentUsage.insightExtractions}`);
  csvLines.push(`Usage,Content Generations,${report.currentUsage.contentGenerations}`);
  csvLines.push(`Usage,Estimated Cost (USD),${report.currentUsage.estimatedCostUsd}`);

  // Section: Data Retention
  csvLines.push(`Data Retention,Policy,${csvEscape(report.dataRetention.policy)}`);
  csvLines.push(`Data Retention,Usage Events Retention (days),${report.dataRetention.usageEventsRetentionDays}`);
  csvLines.push(`Data Retention,Account Data Retention (days),${report.dataRetention.accountDataRetentionDays}`);

  // Billing History header
  csvLines.push("");
  csvLines.push("Billing History");
  csvLines.push("Event ID,Event Type,Cost (USD),Date,Workspace ID");
  for (const event of report.billingHistory) {
    csvLines.push(
      `${csvEscape(event.id)},${csvEscape(event.eventType)},${event.costUsd},${csvEscape(event.createdAt)},${csvEscape(event.workspaceId ?? "")}`
    );
  }

  // Workspaces header
  csvLines.push("");
  csvLines.push("Workspaces");
  csvLines.push("Workspace ID,Name,Slug,Created At,Last Scan At");
  for (const ws of report.workspaces) {
    csvLines.push(
      `${csvEscape(ws.id)},${csvEscape(ws.name)},${csvEscape(ws.slug)},${csvEscape(ws.createdAt ?? "")},${csvEscape(ws.lastScanAt ?? "")}`
    );
  }

  const csvContent = csvLines.join("\n");
  const timestamp = now.toISOString().split("T")[0];

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sessionforge-compliance-report-${timestamp}.csv"`,
    },
  });
}

/** Escapes a value for CSV output (wraps in quotes if it contains commas, quotes, or newlines). */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
