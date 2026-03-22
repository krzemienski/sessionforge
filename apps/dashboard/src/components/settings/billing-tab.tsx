"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  ArrowUpRight,
  Calendar,
  CheckCircle,
  XCircle,
  Zap,
  ExternalLink,
  Loader2,
  Clock,
  DollarSign,
  ArrowDownRight,
  RefreshCw,
  Receipt,
} from "lucide-react";
import { PLANS, type PlanTier } from "@/lib/billing/plans";

interface BillingTabProps {
  workspace: string;
}

interface SubscriptionData {
  planTier: PlanTier;
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

interface UsageData {
  planTier: PlanTier;
  planLimits: {
    sessionScansPerMonth: number | null;
    insightExtractionsPerMonth: number | null;
    contentGenerationsPerMonth: number | null;
  };
  currentUsage: {
    sessionScans: number;
    insightExtractions: number;
    contentGenerations: number;
  };
  percentUsed: {
    sessionScans: number;
    insightExtractions: number;
    contentGenerations: number;
  };
  estimatedCostUsd: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  daysUntilReset: number;
}

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

interface BillingHistoryData {
  events: BillingEvent[];
  total: number;
  planTier: PlanTier;
  stripeCustomerId: string | null;
}

const EVENT_CONFIG: Record<BillingEventType, { icon: typeof CreditCard; color: string }> = {
  charge: { icon: DollarSign, color: "text-sf-success" },
  refund: { icon: ArrowDownRight, color: "text-sf-warning" },
  plan_change: { icon: RefreshCw, color: "text-sf-accent" },
  subscription_created: { icon: CheckCircle, color: "text-sf-success" },
  subscription_canceled: { icon: XCircle, color: "text-sf-error" },
  upcoming_renewal: { icon: Calendar, color: "text-blue-400" },
  usage: { icon: Receipt, color: "text-sf-text-secondary" },
};

const TIER_BADGE_COLORS: Record<PlanTier, string> = {
  free: "bg-sf-bg-tertiary text-sf-text-secondary",
  solo: "bg-blue-500/15 text-blue-400",
  pro: "bg-sf-accent/15 text-sf-accent",
  team: "bg-purple-500/15 text-purple-400",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingTab({ workspace }: BillingTabProps) {
  const subscription = useQuery<SubscriptionData>({
    queryKey: ["billing", "subscription"],
    queryFn: async () => {
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json();
    },
  });

  const usage = useQuery<UsageData>({
    queryKey: ["billing", "usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      if (!res.ok) throw new Error("Failed to load usage");
      return res.json();
    },
  });

  const history = useQuery<BillingHistoryData>({
    queryKey: ["billing", "history"],
    queryFn: async () => {
      const res = await fetch("/api/billing/history?limit=25");
      if (!res.ok) throw new Error("Failed to load billing history");
      return res.json();
    },
  });

  const handleManagePayment = async () => {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create portal session");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // Portal creation failed silently
    }
  };

  if (subscription.isLoading || usage.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-sf-text-muted" />
      </div>
    );
  }

  const tier = subscription.data?.planTier ?? "free";
  const plan = PLANS[tier];
  const status = subscription.data?.status ?? "active";
  const periodEnd = subscription.data?.currentPeriodEnd ?? null;
  const billingStart = usage.data?.billingPeriodStart ?? null;
  const billingEnd = usage.data?.billingPeriodEnd ?? null;
  const nextChargeAmount = plan.pricing.monthly;
  const features = plan.features.filter((f) => f.included);

  return (
    <div className="space-y-6">
      {/* Billing Overview */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold font-display mb-1">
              Billing Overview
            </h2>
            <p className="text-xs text-sf-text-muted">
              Manage your subscription and payment details.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${TIER_BADGE_COLORS[tier]}`}
          >
            {plan.name}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current Plan */}
          <div className="p-4 bg-sf-bg-tertiary border border-sf-border rounded-sf space-y-1">
            <div className="flex items-center gap-2 text-sf-text-secondary">
              <Zap size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Current Plan
              </span>
            </div>
            <p className="text-lg font-semibold text-sf-text-primary">
              {plan.name}
            </p>
            <p className="text-xs text-sf-text-muted">{plan.description}</p>
          </div>

          {/* Status */}
          <div className="p-4 bg-sf-bg-tertiary border border-sf-border rounded-sf space-y-1">
            <div className="flex items-center gap-2 text-sf-text-secondary">
              {status === "active" || status === "trialing" ? (
                <CheckCircle size={14} className="text-sf-success" />
              ) : (
                <XCircle size={14} className="text-sf-error" />
              )}
              <span className="text-xs font-medium uppercase tracking-wide">
                Status
              </span>
            </div>
            <p className="text-lg font-semibold text-sf-text-primary capitalize">
              {status.replace("_", " ")}
            </p>
          </div>

          {/* Billing Period */}
          <div className="p-4 bg-sf-bg-tertiary border border-sf-border rounded-sf space-y-1">
            <div className="flex items-center gap-2 text-sf-text-secondary">
              <Calendar size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Billing Period
              </span>
            </div>
            <p className="text-sm font-medium text-sf-text-primary">
              {formatDate(billingStart)} — {formatDate(billingEnd)}
            </p>
            {usage.data && (
              <p className="text-xs text-sf-text-muted">
                {usage.data.daysUntilReset} day
                {usage.data.daysUntilReset !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>

          {/* Next Charge */}
          <div className="p-4 bg-sf-bg-tertiary border border-sf-border rounded-sf space-y-1">
            <div className="flex items-center gap-2 text-sf-text-secondary">
              <CreditCard size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Next Charge
              </span>
            </div>
            <p className="text-lg font-semibold text-sf-text-primary">
              {nextChargeAmount === 0 ? (
                "Free"
              ) : (
                <>${nextChargeAmount.toFixed(2)}</>
              )}
            </p>
            {periodEnd && (
              <p className="text-xs text-sf-text-muted">
                on {formatDate(periodEnd)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Plan Features */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold font-display mb-1">
            Plan Features
          </h2>
          <p className="text-xs text-sf-text-muted">
            What&apos;s included in your {plan.name} plan.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {plan.features.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2 py-1.5"
            >
              {feature.included ? (
                <CheckCircle size={14} className="text-sf-success flex-shrink-0" />
              ) : (
                <XCircle size={14} className="text-sf-text-muted flex-shrink-0" />
              )}
              <span
                className={`text-sm ${feature.included ? "text-sf-text-primary" : "text-sf-text-muted"}`}
              >
                {feature.label}
                {feature.note && (
                  <span className="text-sf-text-muted ml-1">
                    ({feature.note})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Billing History Timeline */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold font-display mb-1">
            Billing History
          </h2>
          <p className="text-xs text-sf-text-muted">
            Chronological timeline of billing events, charges, and plan changes.
          </p>
        </div>
        {history.isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-sf-bg-tertiary rounded" />
            <div className="h-12 bg-sf-bg-tertiary rounded" />
            <div className="h-12 bg-sf-bg-tertiary rounded" />
          </div>
        ) : history.data && history.data.events.length > 0 ? (
          <div className="space-y-1">
            {history.data.events.map((event) => {
              const config = EVENT_CONFIG[event.type];
              const Icon = config.icon;
              const isFuture = new Date(event.date) > new Date();
              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 p-3 rounded-sf transition-colors ${
                    isFuture
                      ? "bg-blue-500/5 border border-blue-500/20"
                      : "bg-sf-bg-tertiary border border-sf-border"
                  }`}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${config.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-sf-text-primary truncate">
                        {event.description}
                      </span>
                      {event.amountUsd !== null && event.amountUsd > 0 && (
                        <span className="text-sm font-medium text-sf-text-primary flex-shrink-0">
                          ${event.amountUsd.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-sf-text-muted flex items-center gap-1">
                        <Clock size={12} />
                        {isFuture ? "Scheduled: " : ""}
                        {formatDate(event.date)}
                      </span>
                      {isFuture && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400">
                          Upcoming
                        </span>
                      )}
                      {event.metadata.pdfUrl && (
                        <a
                          href={event.metadata.pdfUrl as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sf-accent hover:underline flex items-center gap-1"
                        >
                          <ExternalLink size={10} />
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Receipt size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-muted">No billing history</p>
            <p className="text-xs text-sf-text-muted mt-1">
              {tier === "free"
                ? "Upgrade to a paid plan to start seeing billing events here."
                : "Billing events will appear here as they occur."}
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold font-display mb-1">
            Quick Actions
          </h2>
          <p className="text-xs text-sf-text-muted">
            Manage your payment method or upgrade your plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleManagePayment}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf font-medium text-sm hover:border-sf-border-focus transition-colors"
          >
            <CreditCard size={16} />
            Manage Payment Method
            <ExternalLink size={12} className="text-sf-text-muted" />
          </button>
          {tier !== "team" && (
            <a
              href={`/${workspace}/settings?tab=billing&upgrade=true`}
              className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
            >
              <ArrowUpRight size={16} />
              Upgrade Plan
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
