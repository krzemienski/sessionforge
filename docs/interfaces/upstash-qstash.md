# Upstash QStash Integration

> **Category:** External Interface
> **Service:** Upstash QStash
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

**Service:** Upstash QStash Message Queue and Scheduled Tasks
**Provider:** Upstash
**Purpose:** Schedule recurring automation triggers and delayed content publication
**Documentation:** https://upstash.com/docs/qstash/overview

## Authentication

### Method

Token-based authentication (API token)

### Credentials Management

**Location:** Environment variables (production secrets)

**Environment Variables:**
```bash
UPSTASH_QSTASH_TOKEN=...                        # API token for schedule creation
UPSTASH_QSTASH_CURRENT_SIGNING_KEY=...         # Current key for webhook verification
UPSTASH_QSTASH_NEXT_SIGNING_KEY=...            # Next key for rotation
NEXT_PUBLIC_APP_URL=...                         # Webhook callback URL
```

**Fallback:** When QStash is not configured, automation runs via `/api/cron/automation` endpoint (Vercel Cron fallback).

### Availability Check

```typescript
import { isQStashAvailable } from "@/lib/qstash";

if (!isQStashAvailable()) {
  console.warn("QStash not configured — using Vercel Cron fallback");
}
```

## API Endpoints Used

### createTriggerSchedule() — Create Cron Schedule

**URL:** `POST /schedules` (QStash API)
**Purpose:** Create a recurring cron schedule for automation triggers

**Request:**
```typescript
{
  destination: string,         // Webhook URL (defaults to /api/automation/execute)
  cron: string,                // Cron expression (e.g., "0 9 * * *")
  body: JSON,                  // { triggerId: string }
  headers: { "Content-Type": "application/json" },
}
```

**Response:**
```typescript
{
  scheduleId: string,
}
```

**Example:**
```typescript
const scheduleId = await createTriggerSchedule(
  "trigger-123",
  "0 9 * * *"  // Daily at 9am
);
```

### createFileWatchSchedule() — Create File Watch Schedule

**URL:** `POST /schedules` (QStash API)
**Purpose:** Poll for file system changes every 5 minutes

**Request:**
```typescript
{
  destination: string,         // /api/automation/file-watch
  cron: "*/5 * * * *",        // Every 5 minutes
  body: { triggerId: string },
}
```

**Response:**
```typescript
{
  scheduleId: string,
}
```

### createPublishSchedule() — Create Delayed Publish

**URL:** `POST /publish` (QStash API)
**Purpose:** Schedule content to publish at a future time

**Request:**
```typescript
{
  api: [{
    url: string,              // /api/content/[id]/publish
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { postId: string },
    delay?: number,           // Seconds until execution
  }],
  cron?: string,              // Alternative: cron expression
}
```

**Response:**
```typescript
{
  messageId: string,
}
```

## Webhook Verification

QStash signs all webhook payloads with HMAC-SHA256. Verify before processing:

```typescript
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY,
});

const verified = await receiver.verify({
  signature: req.headers.get("upstash-signature"),
  body: await req.text(),
});
```

## Rate Limits

- **Requests per minute:** 100 (sufficient for typical automation)
- **Schedules per account:** 100 (standard tier)
- **Message size:** 4 MB max

**Handling Strategy:** SDK enforces limits; monitor schedule count before creating new ones.

## Error Handling

### Common Errors

**Error 1: Invalid Token**
- **Cause:** UPSTASH_QSTASH_TOKEN not set or invalid
- **Recovery:** Verify token in env vars, regenerate if needed
- **Retry:** No (config error)

**Error 2: Destination Unreachable**
- **Cause:** Webhook URL returns 5xx or timeout
- **Recovery:** QStash retries with exponential backoff (1s, 5s, 30s, 5m, 30m)
- **Retry:** Automatic (QStash handles)

**Error 3: Invalid Cron Expression**
- **Cause:** Malformed cron syntax
- **Recovery:** Validate cron format before submission
- **Retry:** No (validation error)

### Retry Strategy

QStash automatically retries failed webhooks. For custom retry logic:

```typescript
async function createScheduleWithRetry(
  triggerId: string,
  cron: string,
  maxRetries = 3
) {
  let delay = 1000;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await createTriggerSchedule(triggerId, cron);
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}
```

## Data Mapping

### Trigger → QStash Schedule

| Our Field | QStash Field | Transformation |
|---|---|---|
| `triggerId` | `body.triggerId` | Direct |
| `cronExpression` | `cron` | Direct |
| `callbackUrl` | `destination` | Direct or default |
| `enabled` | (managed implicitly) | Create/delete schedule |

### QStash Webhook → Our Processing

| QStash Header | Our Use |
|---|---|
| `upstash-signature` | Webhook verification |
| `upstash-scheduled-at` | Audit timestamp |
| `upstash-delay-in-seconds` | Execution delay info |

## Testing

### Test Credentials

Dev/staging requires real QStash account or mock via placeholder env vars.

### Local Testing

```bash
export UPSTASH_QSTASH_TOKEN="placeholder-qstash-token"
# Application will log warning and use Vercel Cron fallback
```

### Integration Tests

```typescript
test("create automation trigger schedule", async () => {
  if (!isQStashAvailable()) skip();
  
  const scheduleId = await createTriggerSchedule(
    "test-trigger",
    "0 9 * * *"
  );
  
  expect(scheduleId).toMatch(/^[a-zA-Z0-9]+$/);
});
```

## Monitoring

### Health Checks

**Endpoint:** QStash API endpoint (tested on schedule creation)
**Frequency:** On integration enable, before bulk schedule creation

### Metrics to Track

- Schedule creation success rate
- Webhook delivery success rate
- Average webhook execution time
- Failed webhook retry count
- Schedule count vs limit

### Alerts

- **Critical:** Schedule creation failures (API token invalid)
- **Critical:** Webhook delivery failures (destination unreachable)
- **Warning:** Approaching schedule limit (>80 of 100)
- **Warning:** High retry rate (>20% of webhooks retrying)

## Security Considerations

- API tokens stored as environment variables (never logged)
- Webhook signatures verified via HMAC-SHA256
- No sensitive data in cron schedule body (only IDs)
- Signing key rotation supported (current + next key)

## Compliance

**Data Handling:**
- PII fields: None in QStash (only trigger IDs)
- Retention: QStash retains schedules per SLA
- Geographic restrictions: QStash available globally (data stored per account plan)

**Regulations:**
- SOC2: Upstash is SOC2 Type II compliant
- GDPR: Schedules contain no PII; user can delete via API

## Cost Considerations

**Pricing Model:** Per-message pricing (minimal for typical automation)

**Cost Estimate:** 1,000 schedules × 1 execution per day = ~$3/month (production tier pricing)

## Migration/Upgrade Path

**Current Version:** Upstash QStash API v1

**Fallback Strategy:** Vercel Cron (`/api/cron/automation`) provides graceful degradation when QStash is unavailable.

## Related Documentation

- [Patterns: Scheduling and Automation](../patterns/scheduling-automation.md)
- [Interfaces: Upstash Redis](./upstash-redis.md) — complementary Upstash service

## External Resources

- [QStash Documentation](https://upstash.com/docs/qstash)
- [QStash API Reference](https://upstash.com/docs/qstash/api/schedule/create)
- [QStash Status Page](https://upstash.com/status)

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial integration | capture-docs |
