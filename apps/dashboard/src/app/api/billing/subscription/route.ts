import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getUserSubscription } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await getUserSubscription(session.user.id);

  return NextResponse.json({
    planTier: subscription.planTier,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    stripeCustomerId: subscription.stripeCustomerId,
  });
}
