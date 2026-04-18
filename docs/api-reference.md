# SessionForge API Reference

SessionForge provides **202+ API routes** across internal and public surfaces. This reference documents all major endpoints, authentication patterns, and integration points.

---

## Overview

### API Surfaces

| Surface | Auth | Purpose | Routes |
|---------|------|---------|--------|
| **Internal API** | Session cookie (better-auth) | Dashboard features, workspace operations | 192+ |
| **Public v1 API** | Bearer token (API key) | External integrations, webhooks, content generation | 10 |
| **Public Unauthenticated** | None | Health checks, RSS feeds, social badges | 4 |
| **Webhooks** | Signature verification | Stripe, GitHub integrations | 2 |
| **Cron** | CRON_SECRET header | Scheduled automation runner | 1 |

### Response Formats

**Internal API (private routes):**
```json
{
  "data": { /* success */ },
  "error": null
}
// OR on error:
{
  "error": "Human-readable message",
  "code": "ERROR_CODE_CONSTANT"
}
```

**Public v1 API:**
```json
{
  "data": { /* payload */ },
  "meta": { "total": 100, "limit": 20, "offset": 0 },
  "error": null
}
// OR on error:
{
  "data": null,
  "error": { "message": "...", "code": "ERROR_CODE" }
}
```

---

## Authentication

### Session-Based Auth (Internal Routes)
- **Mechanism**: HTTP-only cookies via `better-auth`
- **Check**: `auth.api.getSession({ headers })`
- **Wrapper**: `withApiHandler` on all internal routes
- **Failure**: `401 Unauthorized`

### API Key Auth (Public v1 Routes)
- **Header**: `Authorization: Bearer {API_KEY}`
- **Key Type**: Workspace-scoped, hashed SHA256
- **Check**: `authenticateApiKey()` or `requireApiKey()` guard
- **Wrapper**: `withV1ApiHandler` on all v1 routes
- **Tracking**: Last-used timestamp debounced 60s via Redis
- **Failure**: `401 Unauthorized`

### Webhook Auth
- **Stripe**: Signature verification via `STRIPE_WEBHOOK_SECRET`
- **GitHub**: Signature verification via webhook secret in workspace config
- **Idempotency**: `stripe_webhook_events` table prevents duplicate processing

### Cron Auth
- **Header**: `Authorization: Bearer {CRON_SECRET}`
- **Env Var**: `CRON_SECRET` (fail-safe in production if missing)
- **Trigger**: Vercel Cron every 5 minutes

---

## Error Codes

All errors include an `ERROR_CODE` constant:

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | Missing/invalid session or API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found or access denied |
| `VALIDATION_ERROR` | 400 | Request body failed Zod schema |
| `BAD_REQUEST` | 400 | Invalid query parameters |
| `INTERNAL_ERROR` | 500 | Server error (never exposes details) |

Quota errors return `402 Payment Required` with usage metadata.

---

## Public v1 API

### 1. Content Routes

#### GET /api/v1/content
List published content with filtering.

**Auth**: Bearer token (API key)
**Query Parameters**:
- `limit` (int, default 20, max 100)
- `offset` (int, default 0)
- `type` (string, optional): Filter by content type (blog_post, twitter_thread, etc.)
- `status` (string, optional): Filter by status (draft, published, archived)

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "My Blog Post",
      "markdown": "# Title\n...",
      "contentType": "blog_post",
      "status": "published",
      "createdAt": "2026-03-09T12:00:00Z",
      "updatedAt": "2026-03-09T12:00:00Z"
    }
  ],
  "meta": {
    "total": 42,
    "limit": 20,
    "offset": 0
  },
  "error": null
}
```

**Curl Example**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://sessionforge.app/api/v1/content?limit=10&status=published"
```

---

#### GET /api/v1/content/[id]
Retrieve single content item.

**Auth**: Bearer token
**Path Parameters**: `id` (uuid)

**Response** (200 OK): Single content object
**Status Codes**: 200, 401, 404

---

#### POST /api/v1/content/generate
Generate new content using Agent SDK.

**Auth**: Bearer token
**Request Body**:
```json
{
  "type": "blog_post",
  "tone": "technical",
  "topic": "Next.js 15 features",
  "customInstructions": "Include code examples"
}
```

**Response** (200 OK): Generated content
**Status Codes**: 200, 401, 409 (generation already running)

---

### 2. Sessions Routes

#### GET /api/v1/sessions
List indexed sessions.

**Auth**: Bearer token
**Query Parameters**: `limit`, `offset`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "projectName": "sessionforge",
      "messageCount": 42,
      "startedAt": "2026-03-09T00:00:00Z",
      "endedAt": "2026-03-09T01:00:00Z",
      "durationSeconds": 3600,
      "costUsd": 0.25,
      "summary": "Implemented API routes"
    }
  ],
  "meta": { "total": 100, "limit": 20, "offset": 0 },
  "error": null
}
```

---

#### POST /api/v1/sessions/upload
Upload a session JSONL file.

**Auth**: Bearer token
**Content-Type**: application/json

**Request Body**:
```json
{
  "projectName": "my-project",
  "sessionData": "...",
  "sourceType": "claude-code"
}
```

**Response** (201 Created): Session metadata
**Status Codes**: 201, 400, 401, 413 (payload too large)

---

#### POST /api/v1/sessions/scan
Scan for new sessions in registered sources.

**Auth**: Bearer token
**Request Body**:
```json
{
  "lookbackDays": 30,
  "fullRescan": false
}
```

---

### 3. Insights Routes

#### GET /api/v1/insights
List extracted insights.

**Auth**: Bearer token
**Query Parameters**: `limit`, `offset`

**Response** (200 OK): Array of insight objects

---

### 4. Webhooks Routes

#### GET /api/v1/webhooks
List workspace webhooks.

**Auth**: Bearer token

---

#### POST /api/v1/webhooks
Create new webhook.

**Auth**: Bearer token
**Request Body**:
```json
{
  "event": "content.published",
  "url": "https://your-server.com/webhook",
  "active": true
}
```

---

#### DELETE /api/v1/webhooks/[id]
Delete webhook by ID.

**Auth**: Bearer token
**Path Parameters**: `id` (uuid)

---

### 5. OpenAPI Schema

#### GET /api/v1/openapi.json
Retrieve complete OpenAPI 3.0 specification for all v1 endpoints.

**Auth**: None (public)
**Response** (200 OK): OpenAPI YAML/JSON document
**Use Case**: Generate SDK clients, validate requests

---

## Internal API by Domain

### Content Management

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET, POST | `/api/content` | Session | List, create posts |
| GET, PUT, DELETE | `/api/content/[id]` | Session | Get, update, delete |
| GET, POST | `/api/content/[id]/conversation` | Session | Editor AI chat turns |
| GET | `/api/content/[id]/revisions` | Session | Revision history |
| POST, DELETE | `/api/content/[id]/revisions/[revisionId]` | Session | Restore, delete revisions |
| GET, POST | `/api/content/[id]/supplementary` | Session | Alt versions (repurposed content) |
| DELETE | `/api/content/[id]/supplementary/[suppId]` | Session | Delete supplementary |
| GET | `/api/content/[id]/media` | Session | Associated media/images |
| GET | `/api/content/[id]/performance` | Session | Analytics data |
| GET, POST | `/api/content/[id]/research/[itemId]` | Session | Research links |
| POST | `/api/content/[id]/seo/generate-meta` | Session | Generate SEO title/desc |
| POST | `/api/content/[id]/review/assign` | Session | Assign for review |
| POST | `/api/content/[id]/review/decide` | Session | Approve/reject review |
| GET | `/api/content/calendar` | Session | Calendar view |
| POST | `/api/content/export` | Session | Export markdown/PDF |
| POST | `/api/content/ingest` | Session | Ingest external URLs |
| POST | `/api/content/mine-sessions` | Session | Generate from indexed sessions |
| GET | `/api/content/streak` | Session | Publishing streak stats |
| POST | `/api/content/suggest-arcs` | Session | Content arc suggestions (Agent) |
| POST | `/api/content/recommendations` | Session | Content recommendations |
| POST | `/api/content/bulk-repurpose` | Session | Batch repurpose |
| POST | `/api/content/[id]/batch-repurpose` | Session | Repurpose to multiple formats |
| POST | `/api/content/[id]/publish/hashnode` | Session | Direct Hashnode publish |

---

### AI Agents (SSE Streaming)

All agent routes return **Server-Sent Events** streams. Client should handle reconnection.

| Route | Purpose | Quota |
|-------|---------|-------|
| `/api/agents/blog` | Generate blog post from insight | 0.05 |
| `/api/agents/social` | Repurpose for social media | 0.03 |
| `/api/agents/newsletter` | Generate newsletter | 0.04 |
| `/api/agents/repurpose` | Repurpose for specific platform | 0.02 |
| `/api/agents/evidence` | Generate citations/evidence | 0.01 |
| `/api/agents/changelog` | Generate changelog entries | 0.02 |
| `/api/agents/strategist` | Content strategy recommendations | 0.04 |
| `/api/agents/chat` | Real-time editor chat with edits | 0.01 per edit |
| `/api/agents/ab-compare` | A/B comparison analysis | 0.02 |
| `/api/agents/runs` | GET only: list agent run history | — |

**SSE Event Format**:
```json
event: progress
data: {"stage": "generating", "message": "Creating markdown...", "runId": "uuid"}

event: edit
data: {"type": "edit_markdown", "path": "main.md", "content": "..."}

event: complete
data: {"runId": "uuid", "result": {...}}

event: error
data: {"error": "Quota exceeded", "retryable": false}
```

**Quota Enforcement**:
- Check via `checkQuota("content_generation")`
- Returns `402 Payment Required` if exceeded
- Response includes usage metadata

---

### Sessions & Indexing

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/sessions` | List with filtering (limit, offset, sort, project, dateFrom, dateTo, hasSummary) |
| POST | `/api/sessions/scan` | Scan local project folders |
| POST | `/api/sessions/batch` | Batch upload sessions |
| GET | `/api/sessions/index-status` | Get indexing progress |
| GET | `/api/sessions/[id]` | Get individual session |
| PUT | `/api/sessions/[id]` | Update session metadata |
| DELETE | `/api/sessions/[id]` | Delete session |
| GET | `/api/sessions/[id]/bookmarks` | List bookmarks in session |
| GET, POST, DELETE | `/api/sessions/[id]/bookmarks/[bookmarkId]` | Manage individual bookmarks |
| GET | `/api/sessions/scan/stream` | SSE stream of scan progress |

---

### Automation & Scheduling

| Method | Route | Description |
|--------|-------|-------------|
| GET, POST | `/api/automation/triggers` | List, create triggers |
| GET, PUT, DELETE | `/api/automation/triggers/[id]` | Manage individual trigger |
| POST | `/api/automation/execute` | Execute trigger (internal, QStash) |
| GET | `/api/automation/runs` | List automation run history |
| GET | `/api/automation/runs/[id]` | Get run details |
| GET, POST | `/api/schedule` | List, create scheduled publishes |
| PUT, DELETE | `/api/schedule/[id]` | Update, delete scheduled item |
| POST | `/api/schedule/publish` | Publish scheduled content now |

**Trigger Types**: `scheduled` (cron), `file_watch` (monitor directories), `on_insight` (manual)

---

### Workspace & Settings

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/workspace` | Create workspace |
| GET | `/api/workspace/[slug]/integrations` | Get Hashnode PAT |
| PUT | `/api/workspace/[slug]/integrations` | Update integration settings |
| GET, PUT | `/api/workspace/[slug]/style-profile` | Get/update writing tone & style |
| GET, PUT | `/api/workspace/[slug]/wordpress` | Get/update WordPress config |
| GET | `/api/workspace/[slug]/activity` | Workspace activity log |

---

### Integrations (OAuth + Webhooks)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET, DELETE | `/api/integrations/devto` | Session | Connect/disconnect Dev.to |
| POST | `/api/integrations/devto/publish` | Session | Publish to Dev.to |
| GET | `/api/integrations/github` | Session | Check GitHub connection status |
| GET | `/api/integrations/github/repos` | Session | List connected GitHub repos |
| POST | `/api/integrations/github/sync` | Session | Sync GitHub activity |
| POST | `/api/integrations/github/webhooks` | Signature | GitHub push/PR webhook handler |
| GET, DELETE | `/api/integrations/twitter` | Session | Connect/disconnect Twitter |
| GET | `/api/integrations/twitter/oauth` | Session | Initiate OAuth flow |
| GET | `/api/integrations/twitter/callback` | Session | OAuth callback handler |
| GET, DELETE | `/api/integrations/linkedin` | Session | Connect/disconnect LinkedIn |
| GET, DELETE | `/api/integrations/medium` | Session | Connect/disconnect Medium |
| GET, DELETE | `/api/integrations/ghost` | Session | Connect/disconnect Ghost CMS |
| GET | `/api/integrations/health/check` | Session | Check integration status |

---

### Billing & Usage

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/usage` | Session | Get current usage & quotas |
| POST | `/api/billing/checkout` | Session | Create Stripe checkout session |
| POST | `/api/billing/portal` | Session | Stripe customer portal link |
| GET | `/api/billing/subscription` | Session | Get subscription status |
| POST | `/api/billing/cancel` | Session | Cancel subscription |
| POST | `/api/billing/downgrade` | Session | Downgrade plan |
| GET | `/api/billing/history` | Session | Billing history & invoices |
| POST | `/api/stripe/webhook` | Stripe sig | Webhook handler (checkout, subscription events) |

---

### Collections & Series

| Method | Route | Description |
|--------|-------|-------------|
| GET, POST | `/api/collections` | List, create collections |
| GET, PUT, DELETE | `/api/collections/[id]` | Manage collection |
| GET | `/api/collections/[id]/posts` | List posts in collection |
| POST | `/api/collections/[id]/export` | Export collection as markdown |
| GET, POST | `/api/series` | List, create series |
| GET, PUT, DELETE | `/api/series/[id]` | Manage series |
| GET | `/api/series/[id]/posts` | List posts in series |
| POST | `/api/series/[id]/export` | Export series as markdown |

---

### Insights & Recommendations

| Method | Route | Description |
|--------|-------|-------------|
| GET, POST | `/api/insights` | List, create insights |
| GET, PUT, DELETE | `/api/insights/[id]` | Manage insight |
| POST | `/api/insights/batch` | Batch extract from sessions |
| POST | `/api/insights/extract` | Extract from content |
| GET | `/api/recommendations` | List recommendations |
| POST | `/api/recommendations/generate` | Generate content recommendations |
| GET | `/api/recommendations/[id]/rate` | Rate recommendation |

---

### Analytics & Observability

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/analytics` | Aggregate analytics |
| GET | `/api/analytics/metrics` | Platform usage metrics |
| POST | `/api/analytics/sync` | Sync metrics from external platforms |
| GET | `/api/analytics/social` | Social media performance |
| POST | `/api/analytics/social/sync` | Sync social analytics |
| GET, PUT | `/api/analytics/platform-settings` | Integration settings |
| GET | `/api/observability/stream` | SSE: pipeline event stream |
| GET | `/api/observability/events` | Recent pipeline events |
| GET | `/api/observability/metrics` | System metrics |
| GET | `/api/observability/runs/[id]` | Get pipeline run details |

---

### Pipeline & Processing

| Method | Route | Streaming | Purpose |
|--------|-------|-----------|---------|
| POST | `/api/pipeline/analyze` | SSE | Unified session→insight→content pipeline |
| POST | `/api/posts/batch` | — | Batch generate posts |
| POST | `/api/jobs/[jobId]/cancel` | — | Cancel background job |

**Pipeline Stages** (SSE events):
- `scanning` — Indexing sessions
- `extracting` — Generating insights
- `generating` — Creating content
- `complete` — Success
- `failed` — Error

---

### Templates & Skills

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/templates` | List built-in + custom templates |
| POST | `/api/templates` | Create custom template |
| GET, PUT, DELETE | `/api/templates/[id]` | Manage template |
| GET | `/api/templates/analytics` | Template usage stats |
| GET, PUT, DELETE | `/api/skills/[id]` | Manage writing skills |
| POST | `/api/skills/import` | Import skills from external source |

---

### API Keys & Webhooks

| Method | Route | Description |
|--------|-------|-------------|
| GET, POST | `/api/api-keys` | List, create API keys |
| DELETE | `/api/api-keys/[id]` | Revoke API key |
| GET, POST | `/api/webhooks` | List, create webhooks |
| DELETE | `/api/webhooks/[id]` | Delete webhook |

---

### Other Internal Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/search` | Full-text search posts + sessions |
| POST | `/api/onboarding` | Complete onboarding flow |
| POST | `/api/activity` | Global activity log |
| POST | `/api/scan-sources` | Manage SSH scan sources |
| GET | `/api/portfolio/settings` | Get portfolio config |
| POST | `/api/portfolio/pinned` | Manage pinned posts |
| POST | `/api/writing-coach/post/[id]` | AI writing feedback |
| POST | `/api/content/[id]/attribution` | Attribution management |
| POST | `/api/backups/validate` | Validate backup integrity |
| POST | `/api/backups/restore` | Restore from backup |

---

## Public Unauthenticated Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/badge/[postId]` | GET | SVG social badge (shields.io style, rate-limited 120/min) |
| `/api/feed/[...slug]` | GET | RSS/Atom feed for published content |
| `/api/public/collections` | GET | List public collections |
| `/api/public/portfolio/[workspace]` | GET | Public portfolio page |
| `/api/public/portfolio/[workspace]/rss` | GET | Portfolio RSS feed |
| `/api/healthcheck` | GET | Health status (200 = up) |

---

## Cron & Scheduled Tasks

### GET /api/cron/automation
Executes all due automation triggers. Runs every 5 minutes via Vercel Cron.

**Auth**: `Authorization: Bearer {CRON_SECRET}`
**Env Vars**: `CRON_SECRET` (fail-safe: missing in production = error)
**Trigger**: Vercel cron schedule
**Max Duration**: 300 seconds (5 minutes)

**Logic**:
1. Loads all workspace-scoped triggers
2. Evaluates cron expressions against lastRunAt
3. Fires `executePipeline()` for each due trigger
4. Records `automationRun` with status, error logs

**Response** (200 OK):
```json
{
  "triggersProcessed": 42,
  "triggered": [{ "id": "uuid", "workspaceId": "uuid" }],
  "errors": []
}
```

---

## Webhooks

### Stripe Webhook Handler
**Route**: `POST /api/stripe/webhook`
**Auth**: Signature verification (STRIPE_WEBHOOK_SECRET)

**Events Handled**:
- `checkout.session.completed` → Create subscription
- `customer.subscription.updated` → Update plan tier
- `customer.subscription.deleted` → Downgrade to free

**Idempotency**: Logged to `stripe_webhook_events` table to prevent duplicate processing.

---

### GitHub Webhook Handler
**Route**: `POST /api/integrations/github/webhooks`
**Auth**: Signature verification (workspace-scoped secret)

**Events Handled**:
- `push` → Sync repository activity
- `pull_request` → Index PR metadata

---

## Environment Variables (API-Affecting)

| Variable | Purpose | Example |
|----------|---------|---------|
| `CRON_SECRET` | Authorizes `/api/cron/automation` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhooks | `whsec_...` |
| `STRIPE_SECRET_KEY` | Stripe SDK initialization | `sk_live_...` |
| `STRIPE_PRICE_SOLO_MONTHLY` | Price ID for solo tier | `price_...` |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID for pro tier | `price_...` |
| `STRIPE_PRICE_TEAM_MONTHLY` | Price ID for team tier | `price_...` |
| `BETTER_AUTH_URL` | Session auth redirect base | `https://sessionforge.app` |
| `UPSTASH_REDIS_URL` | Redis HTTP endpoint | `https://...` |
| `UPSTASH_QSTASH_TOKEN` | QStash API token | `Bearer ...` |
| `SCAN_SOURCE_ENCRYPTION_KEY` | Encrypts SSH credentials in DB | `base64(32-byte key)` |
| `NEXT_PUBLIC_APP_URL` | Client-side app URL | `https://sessionforge.app` |
| `NODE_ENV` | Environment (production/development) | `production` |
| `DISABLE_AI_AGENTS` | Disable all AI routes | `true` or `false` |

---

## Rate Limiting & Quotas

- **Content Generation**: Monthly quota enforced per user via `checkQuota()`
- **Agent Calls**: Each agent operation deducts quota (blog: 0.05, social: 0.03, etc.)
- **Exceeding Quota**: Returns `402 Payment Required` with usage details
- **Public Badge**: 120 requests per 60 seconds (rate-limit headers included)
- **API Key Tracking**: Last-used timestamp updated every 60 seconds (debounced)

---

## Key Abstractions

### `withApiHandler(handler)`
Wraps all internal API routes. Catches `AppError` and unhandled errors, returns normalized JSON responses.

### `withV1ApiHandler(handler)`
Wraps v1 public API routes. Similar to `withApiHandler` but returns v1 response envelope.

### `requireApiKey(request)`
Guard for v1 routes. Throws `AppError(UNAUTHORIZED)` if no valid Bearer token.

### `parseBody(schema, body)`
Validates request body against Zod schema. Throws `AppError(VALIDATION_ERROR)` with field details on failure.

### `checkQuota(userId, quotaType)`
Returns quota status or throws `402` if exceeded. Integrates with Stripe subscription tier.

---

## Streaming & Real-Time

### Server-Sent Events (SSE)
All `/api/agents/*` and `/api/observability/stream` endpoints return SSE streams. Clients should:
1. Open with `fetch(url, { credentials: "include" })`
2. Create `EventSource` to consume events
3. Handle reconnection (automatic with EventSource API)
4. Listen for `error` and `complete` events to close stream

### Web Sockets (Future)
No WebSocket endpoints currently. SSE provides real-time updates.

---

## Testing

### OpenAPI Schema
Generate SDKs or validate requests using `/api/v1/openapi.json`.

### Health Check
```bash
curl https://sessionforge.app/api/healthcheck
# Returns: 200 {"status":"ok"}
```

### Sample Curl (v1 API)
```bash
# Create API key first via dashboard, then:
export API_KEY="sk_live_..."

curl -X GET \
  -H "Authorization: Bearer $API_KEY" \
  https://sessionforge.app/api/v1/content?limit=5

# Expected: {"data": [...], "meta": {...}, "error": null}
```

---

## Deprecations & Migrations

**None currently documented.** All endpoints are active.

---

**Last Updated**: April 18, 2026
**Total Routes**: 202+
**API Version**: v1.0
**SDK**: `@anthropic-ai/claude-agent-sdk` v0.2.63+
