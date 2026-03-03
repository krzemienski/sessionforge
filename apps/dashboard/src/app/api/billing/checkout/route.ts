import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { priceId, workspaceSlug } = body as {
    priceId?: string;
    workspaceSlug?: string;
  };

  if (!priceId) {
    return NextResponse.json({ error: "priceId is required" }, { status: 400 });
  }

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspaceSlug is required" }, { status: 400 });
  }

  const customerId = await getOrCreateStripeCustomer(
    session.user.id,
    session.user.email
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/${workspaceSlug}/usage?upgraded=true`,
    cancel_url: `${baseUrl}/pricing`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
