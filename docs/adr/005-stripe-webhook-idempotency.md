# ADR 005: Stripe Webhook Idempotency Table

**Date:** 2026-04-18
**Status:** Accepted
**Deciders:** Nick (Engineering Lead)

---

## Context

SessionForge integrates with Stripe for subscription billing. Stripe sends webhook events to `POST /api/stripe/webhook/` to notify the app of payment events (e.g., charge succeeded, subscription created).

Webhook delivery is **not guaranteed once.** Stripe retries failed deliveries; the app must handle the same event multiple times idempotently. Without idempotency:

- Duplicate `charge.succeeded` events → Double-charge the customer
- Duplicate `customer.subscription.created` → Create duplicate subscription records
- Duplicate `invoice.paid` → Corrupt accounting ledger

---

## Decision

**Add `stripe_webhook_events` table to track processed webhook event IDs and prevent duplicate processing.**

### Table Definition

```sql
CREATE TABLE stripe_webhook_events (
  event_id TEXT PRIMARY KEY,           -- Stripe's event ID (unique forever)
  event_type TEXT NOT NULL,             -- e.g., "charge.succeeded"
  processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX stripe_webhook_events_processed_at_idx
  ON stripe_webhook_events(processed_at);
```

### Implementation

**Route:** `apps/dashboard/src/app/api/stripe/webhook/route.ts`

```typescript
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);

  // Idempotency check
  const existing = await db
    .select({ processedAt: stripeWebhookEvents.processedAt })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, event.id));

  if (existing.length > 0) {
    console.warn(`Webhook ${event.id} already processed, skipping`);
    return Response.json({ ok: true });
  }

  // Process the event (charge, subscription, etc.)
  // ...

  // Record that we processed this event
  await db.insert(stripeWebhookEvents).values({
    eventId: event.id,
    eventType: event.type,
  });

  return Response.json({ ok: true });
}
```

### Migration

**Created via:** Commit `12ce445` (2026-04-18 00:19:19)

Migration file: `packages/db/migrations/0001_productive_mandarin.sql`

```sql
CREATE TABLE stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX stripe_webhook_events_processed_at_idx
  ON stripe_webhook_events(processed_at);
```

**Application:**
```bash
bun db:migrate                          # Apply migration
# or
bunx drizzle-kit push                   # Auto-apply via drizzle-kit
```

---

## Consequences

### Positive
- **Idempotent webhook handling:** Duplicate Stripe events are safely ignored
- **Audit trail:** `processed_at` timestamp allows cleaning up old events (e.g., older than 90 days)
- **Low overhead:** Single index, no complex logic; query is O(1)

### Negative
- **Requires migration:** Must run `bun db:migrate` before deploying the webhook handler; out-of-order deployment causes 500 errors
- **Data growth:** One row per Stripe event; ~100–1000 events/month depending on business volume
- **Not Stripe-standard:** Ideally Stripe itself would guarantee idempotency; this is an app-level workaround

### Neutral
- **Index maintenance:** `processed_at` index grows indefinitely unless cleaned up; can be pruned per retention policy

---

## Alternatives Considered

1. **Stripe Idempotency Keys (client-side)**
   - Rationale: Stripe's built-in idempotency on request side (charges, subscriptions)
   - Trade-off: Only protects outbound API calls; does not protect webhook processing
   - Rejected: Webhooks are inbound; Stripe controls retry logic, not us

2. **In-memory cache (Redis)**
   - Rationale: Faster than database lookup; no extra table
   - Trade-off: Cache is ephemeral; server restart loses deduplication; multi-instance deployments require shared Redis
   - Rejected: Database table is persistent and simple

3. **Event sourcing (immutable ledger)**
   - Rationale: Append-only log of all events; full audit trail
   - Trade-off: Complex query patterns; harder to debug; overkill for idempotency alone
   - Rejected: Simple ledger table is sufficient

---

## References

- **Commit:** `12ce445` — "db(migration): add stripe_webhook_events for C1 idempotency" (2026-04-18 00:19:19)
- **Route:** `apps/dashboard/src/app/api/stripe/webhook/route.ts` — webhook handler implementation
- **Migration:** `packages/db/migrations/0001_productive_mandarin.sql` — table creation
- **Stripe docs:** https://stripe.com/docs/webhooks/endpoint#handling-duplicate-events

---
