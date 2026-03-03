export type PlanTier = "free" | "solo" | "pro" | "team";

export interface PlanLimits {
  sessionScansPerMonth: number | null;
  insightExtractionsPerMonth: number | null;
  contentGenerationsPerMonth: number | null;
  workspaces: number | null;
}

export interface PlanPricing {
  monthly: number;
  annual: number;
  annualMonthly: number;
}

export interface PlanFeature {
  label: string;
  included: boolean;
  note?: string;
}

export interface Plan {
  tier: PlanTier;
  name: string;
  description: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: PlanFeature[];
  highlighted?: boolean;
}

/** null means unlimited */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    sessionScansPerMonth: 5,
    insightExtractionsPerMonth: 10,
    contentGenerationsPerMonth: 3,
    workspaces: 1,
  },
  solo: {
    sessionScansPerMonth: 100,
    insightExtractionsPerMonth: 500,
    contentGenerationsPerMonth: 50,
    workspaces: 5,
  },
  pro: {
    sessionScansPerMonth: null,
    insightExtractionsPerMonth: null,
    contentGenerationsPerMonth: null,
    workspaces: 20,
  },
  team: {
    sessionScansPerMonth: null,
    insightExtractionsPerMonth: null,
    contentGenerationsPerMonth: null,
    workspaces: null,
  },
};

export const PLAN_FEATURES: Record<PlanTier, PlanFeature[]> = {
  free: [
    { label: "5 session scans / month", included: true },
    { label: "10 insight extractions / month", included: true },
    { label: "3 content generations / month", included: true },
    { label: "1 workspace", included: true },
    { label: "Usage dashboard", included: true },
    { label: "Email support", included: false },
    { label: "Priority processing", included: false },
    { label: "Custom integrations", included: false },
    { label: "Team collaboration", included: false },
    { label: "SSO / SAML", included: false },
  ],
  solo: [
    { label: "100 session scans / month", included: true },
    { label: "500 insight extractions / month", included: true },
    { label: "50 content generations / month", included: true },
    { label: "5 workspaces", included: true },
    { label: "Usage dashboard", included: true },
    { label: "Email support", included: true },
    { label: "Priority processing", included: false },
    { label: "Custom integrations", included: false },
    { label: "Team collaboration", included: false },
    { label: "SSO / SAML", included: false },
  ],
  pro: [
    { label: "Unlimited session scans", included: true },
    { label: "Unlimited insight extractions", included: true },
    { label: "Unlimited content generations", included: true },
    { label: "20 workspaces", included: true },
    { label: "Usage dashboard", included: true },
    { label: "Email support", included: true },
    { label: "Priority processing", included: true },
    { label: "Custom integrations", included: true },
    { label: "Team collaboration", included: false },
    { label: "SSO / SAML", included: false },
  ],
  team: [
    { label: "Unlimited session scans", included: true },
    { label: "Unlimited insight extractions", included: true },
    { label: "Unlimited content generations", included: true },
    { label: "Unlimited workspaces", included: true },
    { label: "Usage dashboard", included: true },
    { label: "Email support", included: true },
    { label: "Priority processing", included: true },
    { label: "Custom integrations", included: true },
    { label: "Team collaboration", included: true },
    { label: "SSO / SAML", included: true },
  ],
};

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    tier: "free",
    name: "Free",
    description: "Try the full pipeline before you commit.",
    pricing: { monthly: 0, annual: 0, annualMonthly: 0 },
    limits: PLAN_LIMITS.free,
    features: PLAN_FEATURES.free,
  },
  solo: {
    tier: "solo",
    name: "Solo",
    description: "For individual developers who need more headroom.",
    pricing: { monthly: 9, annual: 86, annualMonthly: 7.17 },
    limits: PLAN_LIMITS.solo,
    features: PLAN_FEATURES.solo,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    description: "Unlimited AI operations for power users.",
    pricing: { monthly: 29, annual: 278, annualMonthly: 23.17 },
    limits: PLAN_LIMITS.pro,
    features: PLAN_FEATURES.pro,
    highlighted: true,
  },
  team: {
    tier: "team",
    name: "Team",
    description: "Everything unlimited — for the whole team.",
    pricing: { monthly: 49, annual: 470, annualMonthly: 39.17 },
    limits: PLAN_LIMITS.team,
    features: PLAN_FEATURES.team,
  },
};

export function getPlanForTier(tier: PlanTier): Plan {
  return PLANS[tier];
}

export function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString();
}

export function isUnlimited(value: number | null): value is null {
  return value === null;
}
