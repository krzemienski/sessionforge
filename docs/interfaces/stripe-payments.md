# Stripe Payments Integration

> **Category:** External Interface
> **Service:** Stripe
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

**Service:** Stripe Payments Platform
**Provider:** Stripe
**Purpose:** Subscription lifecycle management (checkout, invoicing, upgrades, cancellations)
**Documentation:** https://stripe.com/docs/api

## Authentication

### Method

API Key (Bearer Token)

### Credentials Management

**Location:** Environment variables (production secrets)

**Environment Variables:**
```bash
STRIPE_SECRET_KEY=sk_live_...      # Secret key for API calls
STRIPE_PRICE_SOLO_MONTHLY=price_.. # Price ID for monthly plan
STRIPE_PRICE_SOLO_ANNUAL=price_..  # Price ID for annual plan
STRIPE_PRICE_PRO_MONTHLY=price_..
STRIPE_PRICE_PRO_ANNUAL=price_..
STRIPE_PRICE_TEAM_MONTHLY=price_..
STRIPE_PRICE_TEAM_ANNUAL=price_..
STRIPE_WEBHOOK_SECRET=whsec_...    # Webhook signing secret
```

**Rotation Policy:** Rotate secret key every 12 months; immediately if compromised

### Authentication Example

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const customer = await stripe.customers.create({
  email: "user@example.com",
});
```

## API Endpoints Used

### createPaymentIntent() — Checkout

**URL:** `POST /v1/payment_intents`
**Purpose:** Create checkout session for subscription

**Request:**
```typescript
{
  amount: number,        // cents
  currency: "usd",
  customer: string,      // Stripe customer ID
  metadata: {
    userId: string,
    workspaceId: string,
  },
}
```

**Response:**
```typescript
{
  id: string,
  client_secret: string,
  status: "requires_payment_method" | "succeeded",
}
```

### createSubscription() — Subscribe

**URL:** `POST /v1/subscriptions`
**Purpose:** Create subscription for plan

**Request:**
```typescript
{
  customer: string,      // Stripe customer ID
  items: [{
    price: string,       // e.g., STRIPE_PRICE_PRO_MONTHLY
  }],
  automatic_tax: { enabled: true },
}
```

**Response:**
```typescript
{
  id: string,
  customer: string,
  status: "active" | "incomplete" | "past_due",
  items: {
    data: [{ price: { id: string, recurring: {...} } }],
  },
  current_period_end: number, // Unix timestamp
}
```

## Webhooks

### Webhook 1: customer.subscription.updated

**Event Type:** `customer.subscription.updated`
**Trigger:** Subscription status changes (upgrade, downgrade, cancel)
**URL:** `POST /api/stripe/webhook`

**Payload:**
```json
{
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_...",
      "customer": "cus_...",
      "status": "active",
      "items": {
        "data": [{
          "price": {
            "id": "price_...",
            "recurring": { "interval": "month" }
          }
        }]
      }
    }
  }
}
```

**Signature Verification:**
```typescript
const signature = req.headers.get("stripe-signature");
const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
```

**Handling:**
```typescript
// apps/dashboard/src/app/api/stripe/webhook/route.ts
export async function POST(req: NextRequest) {
  const event = stripe.webhooks.constructEvent(...);
  
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    const planTier = planTierFromPriceId(subscription.items.data[0].price.id);
    
    await db.update(subscriptions)
      .set({
        status: subscription.status,
        planTier,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      })
      .where(eq(subscriptions.stripeCustomerId, subscription.customer));
  }
}
```

### Webhook 2: customer.subscription.deleted

**Event Type:** `customer.subscription.deleted`
**Trigger:** Subscription cancelled
**URL:** `POST /api/stripe/webhook`

**Handling:**
```typescript
if (event.type === "customer.subscription.deleted") {
  await db.update(subscriptions)
    .set({ status: "canceled" })
    .where(...);
}
```

## Rate Limits

- **Requests per second:** 100 RPS (burst)
- **Requests per day:** Effectively unlimited for normal usage

**Handling Strategy:** Stripe SDK implements built-in retry logic; no explicit rate limiting needed

## Data Mapping

### Our Model → Stripe Model

| Our Field | Stripe Field | Transformation |
|---|---|---|
| `userId` | `customer.metadata.userId` | Store in metadata |
| `workspaceId` | `subscription.metadata.workspaceId` | Store in metadata |
| `planTier` | `price.id` lookup | Reverse-map price ID → tier |
| `status` | `subscription.status` | Direct mapping |
| `currentPeriodEnd` | `subscription.current_period_end` | Unix timestamp × 1000 |

### Stripe Model → Our Model

| Stripe Field | Our Field | Transformation |
|---|---|---|
| `subscription.id` | `stripeSubscriptionId` | Direct |
| `subscription.status` | `status` | Coerce to enum (active, canceled, etc.) |
| `subscription.items[0].price.id` | `planTier` | planTierFromPriceId(priceId) |
| `subscription.current_period_end` | `currentPeriodEnd` | new Date(timestamp * 1000) |

## Error Handling

### Common Errors

**Error 1: Invalid API Key**
- **Cause:** STRIPE_SECRET_KEY not set or invalid
- **Recovery:** Verify secret key in env vars, regenerate if needed
- **Retry:** No (config error)

**Error 2: Card Declined**
- **Cause:** Customer's card was rejected by issuer
- **Recovery:** Ask customer to update payment method
- **Retry:** No (customer action required)

**Error 3: Webhook Signature Invalid**
- **Cause:** Webhook body or signature tampered with
- **Recovery:** Verify webhook secret matches Stripe dashboard
- **Retry:** No (security issue)

### Retry Strategy

```typescript
let retries = 0;
while (retries < 3) {
  try {
    return await stripe.subscriptions.create(...);
  } catch (err) {
    if (err.code === "rate_limited" && retries < 2) {
      await sleep(1000 * (retries + 1)); // 1s, 2s, 3s
      retries++;
    } else {
      throw err;
    }
  }
}
```

## Testing

### Test Credentials

**Sandbox URL:** `https://dashboard.stripe.com/test/dashboard`
**Test Secret Key:** `sk_test_...` (available on Stripe dashboard)

### Test Cards

| Card Number | Scenario |
|---|---|
| 4242 4242 4242 4242 | Successful charge |
| 4000 0000 0000 0002 | Card declined |
| 4000 0025 0000 3155 | 3D Secure required |

### Integration Tests

```typescript
test("create subscription with test card", async () => {
  const customer = await stripe.customers.create({
    email: "test@example.com",
  });
  
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: STRIPE_PRICE_PRO_MONTHLY }],
  });
  
  expect(subscription.status).toBe("incomplete");
});
```

## Monitoring

### Health Checks

**Endpoint:** `https://status.stripe.com/`
**Frequency:** Check before critical payment operations

### Metrics to Track

- Subscription creation success rate
- Failed payment rate
- Webhook delivery success rate
- Average webhook latency
- Dunning (retry) recovery rate

### Alerts

- **Critical:** Webhook signature verification failures (security)
- **Critical:** API key invalid (payment processing halted)
- **Warning:** High payment failure rate (>5% in 1h window)
- **Warning:** Webhook delivery failures (>10% in 1h window)

## Security Considerations

- **Secret key exposure:** Immediately rotate key if compromised
- **Webhook signature verification:** Always verify before processing
- **PCI compliance:** Never handle raw card data (Stripe handles)
- **Idempotency:** Use idempotency keys for critical operations

## Compliance

**Data Handling:**
- PII fields: Customer name, email, address stored in Stripe
- Retention policy: Stripe retains per standard data protection policies
- Geographic restrictions: Stripe available in most countries

**Regulations:**
- PCI DSS: Stripe is PCI DSS Level 1 compliant
- GDPR: Stripe processes EU user data; ensure user consent for data processing
- CCPA: User can request deletion of personal data

## Cost Considerations

**Pricing Model:** Percentage of transaction + fixed fee

**Cost per transaction:** 2.9% + $0.30 per successful charge

**Monthly estimate:** For 100 subscriptions at $10/month: $29 + $30 = $59/month

## Migration/Upgrade Path

**Current Version:** API v1 (stable)
**API Updates:** Stripe updates API regularly; SDK stays compatible via versioning

**Breaking Changes:** None in current integration; monitored on Stripe changelog

## Related Documentation

- [Domain: Workspace Membership](../domain/workspace-membership.md) — subscription tied to workspace
- [Patterns: Error Handling](../patterns/error-handling.md) — how to handle payment errors

## External Resources

- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Status Page](https://status.stripe.com/)
- [Stripe Discord Community](https://discord.com/invite/stripe)

## Support

**Support:** Stripe Dashboard Support
**Account Manager:** Available for enterprise accounts
**Escalation:** Contact Stripe Support for billing/critical issues

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial integration | capture-docs |
