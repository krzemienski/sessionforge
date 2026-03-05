import Stripe from "stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY ?? "placeholder-stripe-secret-key";

export const stripe = new Stripe(stripeSecretKey);

export const STRIPE_PRICE_IDS = {
  solo_monthly:
    process.env.STRIPE_PRICE_SOLO_MONTHLY ?? "price_placeholder_solo_monthly",
  solo_annual:
    process.env.STRIPE_PRICE_SOLO_ANNUAL ?? "price_placeholder_solo_annual",
  pro_monthly:
    process.env.STRIPE_PRICE_PRO_MONTHLY ?? "price_placeholder_pro_monthly",
  pro_annual:
    process.env.STRIPE_PRICE_PRO_ANNUAL ?? "price_placeholder_pro_annual",
  team_monthly:
    process.env.STRIPE_PRICE_TEAM_MONTHLY ?? "price_placeholder_team_monthly",
  team_annual:
    process.env.STRIPE_PRICE_TEAM_ANNUAL ?? "price_placeholder_team_annual",
} as const;

/**
 * Returns the Stripe customer ID for the given user, creating both a Stripe
 * customer and a subscription row if they do not yet exist.
 *
 * Upserts `stripeCustomerId` on the subscription record so that subsequent
 * calls return the cached ID without hitting the Stripe API.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  const rows = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const existing = rows[0];

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  // Create a new Stripe customer.
  const customer = await stripe.customers.create({ email });

  if (existing) {
    // Subscription row already exists but has no customer ID — update it.
    await db
      .update(subscriptions)
      .set({ stripeCustomerId: customer.id })
      .where(eq(subscriptions.userId, userId));
  } else {
    // No subscription row yet — insert one with the new customer ID.
    await db.insert(subscriptions).values({
      userId,
      stripeCustomerId: customer.id,
    });
  }

  return customer.id;
}
