"use client";

import { useState } from "react";
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
  AlertTriangle,
  ChevronDown,
  X,
  Download,
  FileText,
  Shield,
  Database,
} from "lucide-react";
import { PLANS, type PlanTier } from "@/lib/billing/plans";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

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

interface CancelPreviewData {
  currentPlan: { tier: string; name: string };
  effectiveDate: string;
  featuresLost: string[];
  dataRetention: { description: string; retentionDays: number };
  usageExceeding: Array<{ metric: string; current: number; freeLimit: number | null }>;
}

interface DowngradePreviewData {
  currentPlan: { tier: string; name: string };
  targetPlan: { tier: PlanTier; name: string };
  effectiveDate: string;
  featuresLost: string[];
  featuresKept: string[];
  usageImpact: Array<{ metric: string; current: number; newLimit: string; overLimit: boolean }>;
  pricingChange: { current: { monthly: number; annual: number }; target: { monthly: number; annual: number }; savingsMonthly: number; savingsAnnual: number };
}

const TIER_ORDER: PlanTier[] = ["free", "solo", "pro", "team"];

function getLowerTiers(current: PlanTier): PlanTier[] {
  const idx = TIER_ORDER.indexOf(current);
  return TIER_ORDER.slice(0, idx);
}

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
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [cancelPreview, setCancelPreview] = useState<CancelPreviewData | null>(null);
  const [downgradePreview, setDowngradePreview] = useState<DowngradePreviewData | null>(null);
  const [selectedDowngradeTier, setSelectedDowngradeTier] = useState<PlanTier | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExportingBilling, setIsExportingBilling] = useState(false);
  const [isExportingPolicy, setIsExportingPolicy] = useState(false);

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
      showToast("Failed to open payment portal. Please try again.", "error");
    }
  };

  const handleExportBillingReport = async (format: "json" | "csv") => {
    setIsExportingBilling(true);
    try {
      const res = await fetch(`/api/billing/export?format=${format}`);
      if (!res.ok) throw new Error("Failed to export billing report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billing-report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Billing report exported as ${format.toUpperCase()}`, "success");
    } catch {
      showToast("Failed to export billing report", "error");
    } finally {
      setIsExportingBilling(false);
    }
  };

  const handleExportWorkspacePolicy = async () => {
    setIsExportingPolicy(true);
    try {
      const res = await fetch(`/api/billing/export?format=json&type=policy`);
      if (!res.ok) throw new Error("Failed to export workspace policy");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workspace-policy.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Workspace policy exported", "success");
    } catch {
      showToast("Failed to export workspace policy", "error");
    } finally {
      setIsExportingPolicy(false);
    }
  };

  const handleOpenCancelDialog = async () => {
    setShowCancelDialog(true);
    setIsLoadingPreview(true);
    setCancelPreview(null);
    try {
      const res = await fetch("/api/billing/cancel-preview");
      if (!res.ok) throw new Error("Failed to load cancellation preview");
      const data = await res.json();
      setCancelPreview(data);
    } catch {
      setCancelPreview({
        currentPlan: { tier, name: plan.name },
        effectiveDate: subscription.data?.currentPeriodEnd ?? new Date().toISOString(),
        featuresLost: ["All paid features will be removed"],
        dataRetention: { description: "Your data will be retained for 30 days after cancellation.", retentionDays: 30 },
        usageExceeding: [],
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsCanceling(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Cancellation failed");
      }
      showToast("Subscription canceled successfully", "success");
      setShowCancelDialog(false);
      subscription.refetch();
      history.refetch();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to cancel subscription",
        "error"
      );
    } finally {
      setIsCanceling(false);
    }
  };

  const handleOpenDowngradeDialog = async () => {
    setShowDowngradeDialog(true);
    setDowngradePreview(null);
    setSelectedDowngradeTier(null);
  };

  const handleSelectDowngradeTier = async (targetTier: PlanTier) => {
    setSelectedDowngradeTier(targetTier);
    setIsLoadingPreview(true);
    setDowngradePreview(null);
    try {
      const res = await fetch(`/api/billing/downgrade-preview?to=${targetTier}`);
      if (!res.ok) throw new Error("Failed to load downgrade preview");
      const data = await res.json();
      setDowngradePreview(data);
    } catch {
      const targetPlan = PLANS[targetTier];
      const currentPlan = PLANS[tier];
      const currentFeatures = currentPlan.features.filter((f) => f.included).map((f) => f.label);
      const targetFeatures = targetPlan.features.filter((f) => f.included).map((f) => f.label);
      setDowngradePreview({
        currentPlan: { tier, name: plan.name },
        targetPlan: { tier: targetTier, name: PLANS[targetTier].name },
        effectiveDate: subscription.data?.currentPeriodEnd ?? new Date().toISOString(),
        featuresLost: currentFeatures.filter((f) => !targetFeatures.includes(f)),
        featuresKept: targetFeatures,
        usageImpact: [],
        pricingChange: {
          current: { monthly: plan.pricing.monthly, annual: plan.pricing.annual },
          target: { monthly: PLANS[targetTier].pricing.monthly, annual: PLANS[targetTier].pricing.annual },
          savingsMonthly: plan.pricing.monthly - PLANS[targetTier].pricing.monthly,
          savingsAnnual: plan.pricing.annual - PLANS[targetTier].pricing.annual,
        },
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedDowngradeTier) return;
    setIsDowngrading(true);
    try {
      const res = await fetch("/api/billing/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTier: selectedDowngradeTier }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Downgrade failed");
      }
      showToast(`Downgraded to ${PLANS[selectedDowngradeTier].name} plan`, "success");
      setShowDowngradeDialog(false);
      subscription.refetch();
      usage.refetch();
      history.refetch();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to downgrade",
        "error"
      );
    } finally {
      setIsDowngrading(false);
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

      {/* Compliance & Data Export */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold font-display mb-1">
            Compliance & Data Export
          </h2>
          <p className="text-xs text-sf-text-muted">
            Export billing data and workspace policies for compliance and audit purposes.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleExportBillingReport("json")}
            disabled={isExportingBilling}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf font-medium text-sm hover:border-sf-border-focus transition-colors disabled:opacity-50"
          >
            {isExportingBilling ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Export Billing Report (JSON)
          </button>
          <button
            onClick={() => handleExportBillingReport("csv")}
            disabled={isExportingBilling}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf font-medium text-sm hover:border-sf-border-focus transition-colors disabled:opacity-50"
          >
            {isExportingBilling ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            Export Billing Report (CSV)
          </button>
          <button
            onClick={handleExportWorkspacePolicy}
            disabled={isExportingPolicy}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf font-medium text-sm hover:border-sf-border-focus transition-colors disabled:opacity-50"
          >
            {isExportingPolicy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Shield size={16} />
            )}
            Export Workspace Policy
          </button>
        </div>

        <div className="p-4 bg-sf-bg-tertiary border border-sf-border rounded-sf space-y-3">
          <div className="flex items-center gap-2 text-sf-text-secondary">
            <Database size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">
              Data Retention Policy
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Billing history & invoices", retention: "7 years", description: "Retained for tax and legal compliance" },
              { label: "Usage metrics", retention: "24 months", description: "Session scans, extractions, and generation counts" },
              { label: "Payment method details", retention: "Until removed", description: "Managed securely via Stripe; not stored locally" },
              { label: "Session data", retention: "Per workspace policy", description: "Retained according to your workspace configuration" },
            ].map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-4 py-2 border-b border-sf-border last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-sf-text-primary">{item.label}</p>
                  <p className="text-xs text-sf-text-muted">{item.description}</p>
                </div>
                <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sf-bg-secondary text-sf-text-secondary border border-sf-border">
                  {item.retention}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cancellation & Downgrade */}
      {tier !== "free" && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold font-display mb-1">
              Subscription Changes
            </h2>
            <p className="text-xs text-sf-text-muted">
              Downgrade or cancel your subscription. Changes take effect at the end of your billing period.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {getLowerTiers(tier).length > 0 && (
              <button
                onClick={handleOpenDowngradeDialog}
                className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary px-4 py-2 rounded-sf font-medium text-sm hover:border-sf-border-focus hover:text-sf-text-primary transition-colors"
              >
                <ChevronDown size={16} />
                Downgrade Plan
              </button>
            )}
            <button
              onClick={handleOpenCancelDialog}
              className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-error/30 text-sf-error px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-error/10 transition-colors"
            >
              <XCircle size={16} />
              Cancel Subscription
            </button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={isCanceling ? undefined : () => setShowCancelDialog(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold font-display text-sf-text-primary">
                Cancel Subscription
              </h2>
              <button
                onClick={() => setShowCancelDialog(false)}
                disabled={isCanceling}
                className={cn(
                  "text-sf-text-secondary hover:text-sf-text-primary transition-colors",
                  isCanceling && "opacity-50 cursor-not-allowed"
                )}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-sf-text-muted" />
              </div>
            ) : cancelPreview ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-sf-error/10 border border-sf-error/20 rounded-sf">
                  <AlertTriangle size={18} className="text-sf-error flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-sf-text-primary">
                    <p className="font-medium">Are you sure you want to cancel?</p>
                    <p className="text-sf-text-secondary mt-1">
                      This action will cancel your {plan.name} subscription.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                    <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-1">
                      Effective Date
                    </p>
                    <p className="text-sm text-sf-text-primary">
                      {formatDate(cancelPreview.effectiveDate)}
                    </p>
                  </div>

                  {cancelPreview.featuresLost.length > 0 && (
                    <div className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                      <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-2">
                        Features You&apos;ll Lose
                      </p>
                      <ul className="space-y-1">
                        {cancelPreview.featuresLost.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm text-sf-text-primary">
                            <XCircle size={12} className="text-sf-error flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                    <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-1">
                      Data Retention
                    </p>
                    <p className="text-sm text-sf-text-primary">
                      {cancelPreview.dataRetention.description}
                    </p>
                  </div>

                  {cancelPreview.usageExceeding.length > 0 && (
                    <div className="p-3 bg-sf-warning/10 border border-sf-warning/20 rounded-sf">
                      <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-2">
                        Usage Exceeding Free Limits
                      </p>
                      <ul className="space-y-1">
                        {cancelPreview.usageExceeding.map((item) => (
                          <li key={item.metric} className="flex items-center gap-2 text-sm text-sf-text-primary">
                            <AlertTriangle size={12} className="text-sf-warning flex-shrink-0" />
                            {item.metric}: {item.current} used (free limit: {item.freeLimit ?? "N/A"})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setShowCancelDialog(false)}
                    disabled={isCanceling}
                    className="px-4 py-2 text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary transition-colors"
                  >
                    Keep Subscription
                  </button>
                  <button
                    onClick={handleConfirmCancel}
                    disabled={isCanceling}
                    className="flex items-center gap-2 bg-sf-error text-white px-4 py-2 rounded-sf text-sm font-medium hover:bg-sf-error/90 disabled:opacity-50 transition-colors"
                  >
                    {isCanceling ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <XCircle size={14} />
                    )}
                    Confirm Cancellation
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Downgrade Dialog */}
      {showDowngradeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={isDowngrading ? undefined : () => setShowDowngradeDialog(false)}
          />
          <div className="relative z-10 w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold font-display text-sf-text-primary">
                Downgrade Plan
              </h2>
              <button
                onClick={() => setShowDowngradeDialog(false)}
                disabled={isDowngrading}
                className={cn(
                  "text-sf-text-secondary hover:text-sf-text-primary transition-colors",
                  isDowngrading && "opacity-50 cursor-not-allowed"
                )}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Tier Selection */}
              {!selectedDowngradeTier ? (
                <div className="space-y-2">
                  <p className="text-sm text-sf-text-secondary mb-3">
                    Select a plan to downgrade to:
                  </p>
                  {getLowerTiers(tier).map((lowerTier) => {
                    const targetPlan = PLANS[lowerTier];
                    return (
                      <button
                        key={lowerTier}
                        onClick={() => handleSelectDowngradeTier(lowerTier)}
                        className="w-full flex items-center justify-between p-4 bg-sf-bg-tertiary border border-sf-border rounded-sf hover:border-sf-border-focus transition-colors text-left"
                      >
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${TIER_BADGE_COLORS[lowerTier]} mb-1`}>
                            {targetPlan.name}
                          </span>
                          <p className="text-xs text-sf-text-muted mt-1">
                            {targetPlan.description}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-lg font-semibold text-sf-text-primary">
                            {targetPlan.pricing.monthly === 0 ? "Free" : `$${targetPlan.pricing.monthly}`}
                          </p>
                          {targetPlan.pricing.monthly > 0 && (
                            <p className="text-xs text-sf-text-muted">/month</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : isLoadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-sf-text-muted" />
                </div>
              ) : downgradePreview ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-sf-warning/10 border border-sf-warning/20 rounded-sf">
                    <AlertTriangle size={18} className="text-sf-warning flex-shrink-0" />
                    <p className="text-sm text-sf-text-primary">
                      You&apos;re downgrading from <strong>{plan.name}</strong> to{" "}
                      <strong>{downgradePreview.targetPlan.name}</strong>.
                    </p>
                  </div>

                  {/* Plan Comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                      <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-1">
                        Current
                      </p>
                      <p className="text-sm font-semibold text-sf-text-primary">{plan.name}</p>
                      <p className="text-xs text-sf-text-muted">
                        ${plan.pricing.monthly}/mo
                      </p>
                    </div>
                    <div className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                      <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-1">
                        New Plan
                      </p>
                      <p className="text-sm font-semibold text-sf-text-primary">
                        {downgradePreview.targetPlan.name}
                      </p>
                      <p className="text-xs text-sf-text-muted">
                        {downgradePreview.pricingChange.target.monthly === 0
                          ? "Free"
                          : `$${downgradePreview.pricingChange.target.monthly}/mo`}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                    <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-1">
                      Effective Date
                    </p>
                    <p className="text-sm text-sf-text-primary">
                      {formatDate(downgradePreview.effectiveDate)}
                    </p>
                  </div>

                  {downgradePreview.featuresLost.length > 0 && (
                    <div className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                      <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-2">
                        Features You&apos;ll Lose
                      </p>
                      <ul className="space-y-1">
                        {downgradePreview.featuresLost.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm text-sf-text-primary">
                            <XCircle size={12} className="text-sf-error flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {downgradePreview.usageImpact.filter((i) => i.overLimit).length > 0 && (
                    <div className="p-3 bg-sf-warning/10 border border-sf-warning/20 rounded-sf">
                      <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-2">
                        Usage Over New Limits
                      </p>
                      <ul className="space-y-1">
                        {downgradePreview.usageImpact
                          .filter((i) => i.overLimit)
                          .map((item) => (
                            <li key={item.metric} className="flex items-center gap-2 text-sm text-sf-text-primary">
                              <AlertTriangle size={12} className="text-sf-warning flex-shrink-0" />
                              {item.metric}: {item.current} used (new limit: {item.newLimit})
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {downgradePreview.pricingChange.savingsMonthly > 0 && (
                    <div className="p-3 bg-sf-success/10 border border-sf-success/20 rounded-sf">
                      <p className="text-xs font-medium text-sf-text-secondary uppercase tracking-wide mb-1">
                        Monthly Savings
                      </p>
                      <p className="text-sm font-medium text-sf-success">
                        ${downgradePreview.pricingChange.savingsMonthly.toFixed(2)}/mo
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-sf-border mt-4">
              {selectedDowngradeTier && !isLoadingPreview ? (
                <>
                  <button
                    onClick={() => {
                      setSelectedDowngradeTier(null);
                      setDowngradePreview(null);
                    }}
                    disabled={isDowngrading}
                    className="px-4 py-2 text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmDowngrade}
                    disabled={isDowngrading}
                    className="flex items-center gap-2 bg-sf-warning text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium hover:bg-sf-warning/90 disabled:opacity-50 transition-colors"
                  >
                    {isDowngrading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    Confirm Downgrade
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowDowngradeDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
