# SessionForge API Reference

The SessionForge dashboard provides 150+ route files across 16 functional domains. This reference documents the key endpoints and authentication mechanisms.

## Authentication

SessionForge uses two authentication schemes:

### Session-Based Auth (Private API)
Internal endpoints require user session authentication via `better-auth`. Session validation happens automatically through `auth.api.getSession({ headers })`.

**Error responses:**
- `401 Unauthorized` — Missing or invalid session
- `404 Not Found` — Resource not found or workspace ownership mismatch

### API Key Auth (Public v1 API)
Public v1 endpoints require API key authentication via `x-api-key` header. API keys are workspace-scoped.

**Error response:**
- `401 Unauthorized` — Missing or invalid API key

## Response Format

All endpoints return JSON. Private API endpoints use a uniform error handler (`withApiHandler`) that returns:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE_CONSTANT"
}
```

Successful responses vary by endpoint; see group documentation below.

---

## 1. Auth

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/[...all]` | GET, POST | better-auth | Catch-all for authentication endpoints (email, password, OAuth providers) |

The catch-all route delegates to better-auth's next.js handler. Supports email/password signup, login, logout, and OAuth sign-in for GitHub, Google, and other providers.

---

## 2. Sessions

Manage Claude sessions indexed from user projects.

| Route | Method | Auth | Query Params | Purpose |
|-------|--------|------|--------------|---------|
| `/api/sessions` | GET | Session | `limit`, `offset`, `sort`, `order`, `project`, `workspace`, `minMessages`, `maxMessages`, `dateFrom`, `dateTo`, `hasSummary` | List sessions with filtering & sorting |
| `/api/sessions` | POST | Session | — | Create a new session (deprecated) |
| `/api/sessions/[id]` | GET, PUT, DELETE | Session | — | Get, update, delete individual session |
| `/api/sessions/scan` | POST | Session | — | Scan project folders for new sessions |
| `/api/sessions/batch` | POST | Session | — | Batch upload sessions |
| `/api/sessions/index-status` | GET | Session | `workspace` | Get indexing progress for workspace |
| `/api/v1/sessions` | GET | API Key | `limit`, `offset` | List sessions (public API) |
| `/api/v1/sessions/upload` | POST | API Key | — | Upload session via public API |
| `/api/v1/sessions/scan` | POST | API Key | — | Scan via public API |

**Response example (GET /api/sessions):**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "projectName": "string",
      "messageCount": 42,
      "startedAt": "2026-03-09T00:00:00Z",
      "endedAt": "2026-03-09T01:00:00Z",
      "durationSeconds": 3600,
      "costUsd": 0.25,
      "summary": "string or null"
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

---

## 3. Content

CRUD operations and publishing for blog posts, tweets, LinkedIn posts, newsletters, and other content types.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/content` | GET, POST | Session | List, create posts |
| `/api/content/[id]` | GET, PUT, DELETE | Session | Get, update, delete post |
| `/api/content/[id]/conversation` | GET, POST | Session | Get/add conversation turns in editor |
| `/api/content/[id]/revisions` | GET | Session | Retrieve revision history |
| `/api/content/[id]/supplementary` | POST, GET | Session | Generate/retrieve supplementary content (alt versions) |
| `/api/content/[id]/supplementary/[suppId]` | DELETE | Session | Delete supplementary content item |
| `/api/content/calendar` | GET | Session | Get calendar view of content timeline |
| `/api/content/export` | POST | Session | Export content as markdown/pdf |
| `/api/content/ingest` | POST | Session | Ingest external content sources |
| `/api/content/mine-sessions` | POST | Session | Generate posts from indexed sessions |
| `/api/content/recommendations` | GET | Session | Get recommended topics/angles |
| `/api/content/streak` | GET | Session | Get publishing streak stats |
| `/api/content/suggest-arcs` | POST | Session | Suggest content arcs (Agent SDK) |
| `/api/v1/content` | GET | API Key | List content (public API) |
| `/api/v1/content/[id]` | GET | API Key | Retrieve content (public API) |
| `/api/v1/content/generate` | POST | API Key | Generate new content (public API) |

**Request body (POST /api/content):**
```json
{
  "workspaceSlug": "my-workspace",
  "title": "My Blog Post",
  "markdown": "# Title\n\nContent...",
  "contentType": "blog_post",
  "toneUsed": "technical"
}
```

**Content types:** `blog_post`, `twitter_thread`, `linkedin_post`, `devto_post`, `newsletter`, `changelog`, `custom`

---

## 4. Agents

Streaming AI agents for blog writing, social media repurposing, evidence analysis, and real-time chat.

| Route | Method | Auth | Streaming | Purpose |
|-------|--------|------|-----------|---------|
| `/api/agents/blog` | POST | Session | SSE | Generate blog post from insight |
| `/api/agents/social` | POST | Session | SSE | Generate social media content |
| `/api/agents/newsletter` | POST | Session | SSE | Generate newsletter |
| `/api/agents/repurpose` | POST | Session | SSE | Repurpose content for other platforms |
| `/api/agents/evidence` | POST | Session | SSE | Generate evidence/citation for content |
| `/api/agents/changelog` | POST | Session | SSE | Generate changelog entries |
| `/api/agents/strategist` | POST | Session | SSE | Content strategy recommendations |
| `/api/agents/chat` | POST | Session | SSE | Real-time editor chat with markdown edit suggestions |
| `/api/agents/runs` | GET | Session | — | List agent run history |

All agent endpoints return Server-Sent Events (SSE) streams. Quota enforcement via `checkQuota("content_generation")`.

**Request body (POST /api/agents/blog):**
```json
{
  "workspaceSlug": "my-workspace",
  "insightId": "uuid",
  "tone": "technical",
  "customInstructions": "Add examples...",
  "templateId": "uuid" (optional)
}
```

---

## 5. Automation

Trigger and schedule content generation, file watching, and automation runs.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/automation/triggers` | GET, POST | Session | List, create automation triggers |
| `/api/automation/triggers/[id]` | GET, PUT, DELETE | Session | Manage individual trigger |
| `/api/automation/execute` | POST | QStash | Execute trigger (internal) |
| `/api/automation/runs` | GET | Session | List automation run history |
| `/api/automation/runs/[id]` | GET | Session | Get run details |
| `/api/automation/file-watch` | POST | Session | Register file watch trigger |
| `/api/automation/social-sync` | POST | Session | Sync with social platform automation |
| `/api/cron/automation` | POST | QStash | Process all triggers (cron runner) |
| `/api/scan-sources` | GET, POST | Session | List, add SSH scan sources |
| `/api/scan-sources/[id]` | PUT, DELETE | Session | Update, delete source |
| `/api/scan-sources/[id]/check` | POST | Session | Test source connectivity |

**Request body (POST /api/automation/triggers):**
```json
{
  "workspaceSlug": "my-workspace",
  "name": "Daily Blog Generator",
  "triggerType": "scheduled",
  "contentType": "blog_post",
  "cronExpression": "0 9 * * *",
  "lookbackWindow": "last_7_days"
}
```

**Trigger types:** `scheduled`, `file_watch`, `on_insight`

---

## 6. Analytics

Platform metrics, social media analytics, and settings sync.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/analytics` | GET | Session | Get aggregate analytics |
| `/api/analytics/metrics` | GET | Session | Get platform usage metrics |
| `/api/analytics/sync` | POST | Session | Sync metrics from external platforms |
| `/api/analytics/platform-settings` | GET, PUT | Session | Manage analytics platform integrations |
| `/api/analytics/social` | GET | Session | Get social media performance stats |
| `/api/analytics/social/sync` | POST | Session | Sync social media analytics |

---

## 7. Integrations

Connect with external platforms (GitHub, Hashnode, WordPress, Dev.to, Medium, Ghost, LinkedIn, Twitter).

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/integrations/devto` | GET, POST, DELETE | Session | Connect to Dev.to |
| `/api/integrations/devto/publish` | POST | Session | Publish to Dev.to |
| `/api/integrations/ghost` | GET, POST, DELETE | Session | Connect to Ghost CMS |
| `/api/integrations/ghost/publish` | POST | Session | Publish to Ghost |
| `/api/integrations/medium` | GET, POST, DELETE | Session | Connect to Medium |
| `/api/integrations/medium/oauth` | GET | Session | Medium OAuth initiation |
| `/api/integrations/medium/callback` | GET | Session | Medium OAuth callback |
| `/api/integrations/medium/publish` | POST | Session | Publish to Medium |
| `/api/integrations/github` | GET, DELETE | Session | Connect/check GitHub integration |
| `/api/integrations/github/repos` | GET | Session | List GitHub repos |
| `/api/integrations/github/sync` | POST | Session | Sync GitHub data |
| `/api/integrations/github/activity` | GET | Session | GitHub activity feed |
| `/api/integrations/github/privacy` | GET, PUT, DELETE | Session | GitHub privacy settings |
| `/api/integrations/github/webhooks` | POST | Session | GitHub webhook handler |
| `/api/integrations/twitter` | GET, DELETE | Session | Connect to Twitter |
| `/api/integrations/twitter/oauth` | GET | Session | Twitter OAuth initiation |
| `/api/integrations/twitter/callback` | GET | Session | Twitter OAuth callback |
| `/api/integrations/linkedin` | GET, DELETE | Session | Connect to LinkedIn |
| `/api/integrations/linkedin/oauth` | GET | Session | LinkedIn OAuth initiation |
| `/api/integrations/linkedin/callback` | GET | Session | LinkedIn OAuth callback |
| `/api/workspace/[slug]/integrations` | GET, PUT | Session | Hashnode PAT (via workspace settings) |

**Response (GET /api/integrations/github):**
```json
{
  "connected": true,
  "username": "octocat",
  "enabled": true,
  "connectedAt": "2026-03-09T00:00:00Z"
}
```

---

## 8. Workspace

Workspace settings, style profiles, integrations, and activity logs.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/workspace/[slug]/integrations` | GET, PUT | Session | Get/update Hashnode integration settings |
| `/api/workspace/[slug]/style-profile` | GET, PUT | Session | Get/update writing tone & style |
| `/api/workspace/[slug]/wordpress` | GET, PUT | Session | Get/update WordPress config |
| `/api/workspace/[slug]/template-defaults` | GET, PUT | Session | Get/update content template defaults |
| `/api/workspace/[slug]/activity` | GET | Session | Get workspace activity log |

---

## 9. Billing

Stripe integration for checkout, subscription management, and usage tracking.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/billing/checkout` | POST | Session | Create Stripe checkout session |
| `/api/billing/portal` | POST | Session | Create Stripe customer portal link |
| `/api/billing/subscription` | GET | Session | Get subscription status |
| `/api/stripe/webhook` | POST | Stripe | Handle Stripe webhook events |
| `/api/usage` | GET | Session | Get current usage & quota stats |

**Request (POST /api/billing/checkout):**
```json
{
  "priceId": "price_xxx",
  "workspaceSlug": "my-workspace"
}
```

**Stripe webhook events handled:**
- `checkout.session.completed` — Activate subscription
- `customer.subscription.updated` — Update plan tier
- `customer.subscription.deleted` — Downgrade to free

---

## 10. Collections & Series

Organize content into collections and series.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/collections` | GET, POST | Session | List, create collections |
| `/api/collections/[id]` | GET, PUT, DELETE | Session | Manage collection |
| `/api/series` | GET, POST | Session | List, create series |
| `/api/series/[id]` | GET, PUT, DELETE | Session | Manage series |
| `/api/series/[id]/posts` | GET | Session | Get posts in series |
| `/api/series/[id]/export` | POST | Session | Export series as markdown |

---

## 11. Insights

Extract insights from sessions and manage insight-to-content pipeline.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/insights` | GET, POST | Session | List, create insights |
| `/api/insights/[id]` | GET, PUT, DELETE | Session | Manage insight |
| `/api/insights/batch` | POST | Session | Batch generate insights from sessions |
| `/api/insights/extract` | POST | Session | Extract insights from content |
| `/api/v1/insights` | GET | API Key | List insights (public API) |

---

## 12. Jobs & Background Processing

Queue and manage background jobs.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/jobs/[jobId]` | GET | Session | Get job status |
| `/api/jobs/process` | POST | QStash | Process queued job (internal) |
| `/api/posts/batch` | POST | Session | Batch generate posts |

---

## 13. Observability

Monitor active pipeline runs and observe system state.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/observability/stream` | GET | Session | SSE stream of pipeline events |
| `/api/observability/events` | GET | Session | Get recent pipeline events |

---

## 13a. Pipeline

Execute unified content analysis pipelines with streaming progress events.

| Route | Method | Auth | Streaming | Purpose |
|-------|--------|------|-----------|---------|
| `/api/pipeline/analyze` | POST | Session | SSE | Analyze sessions and generate content (unified pipeline) |

**Request body (POST /api/pipeline/analyze):**
```json
{
  "workspaceSlug": "my-workspace",
  "lookbackDays": 90
}
```

**Response: SSE stream with stage events**
```json
{
  "stage": "scanning",
  "message": "Pipeline started",
  "runId": "uuid"
}
```

**Pipeline stages:** `scanning`, `extracting`, `generating`, `complete`, `failed`

**Error responses:**
- `409 Conflict` — Analysis already in progress for workspace
- Returns `runId` of existing active run

---

## 14. Templates

Manage content templates: built-in templates and workspace-specific custom templates.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/templates` | GET | Session | List built-in and custom templates |
| `/api/templates` | POST | Session | Create custom template |

**Request (GET /api/templates):**
```
Query params: workspaceSlug (required)
```

**Response (GET /api/templates):**
```json
{
  "templates": [
    {
      "id": "blog-post",
      "workspaceId": null,
      "name": "Blog Post",
      "slug": "blog-post",
      "templateType": "built_in",
      "contentType": "blog_post",
      "description": "Structure for technical blog posts",
      "structure": "...",
      "toneGuidance": "...",
      "exampleContent": "...",
      "isActive": true,
      "createdBy": null,
      "usageCount": 0
    },
    {
      "id": "uuid",
      "workspaceId": "workspace-id",
      "name": "Custom Template",
      "slug": "custom-template",
      "templateType": "custom",
      "contentType": "blog_post",
      "description": "My custom template",
      "structure": "...",
      "toneGuidance": "...",
      "exampleContent": "...",
      "isActive": true,
      "createdBy": "user-id",
      "usageCount": 0
    }
  ]
}
```

**Request body (POST /api/templates):**
```json
{
  "workspaceSlug": "my-workspace",
  "name": "My Custom Template",
  "slug": "my-custom-template",
  "contentType": "blog_post",
  "description": "Custom template for technical posts",
  "structure": "Optional structure guide...",
  "toneGuidance": "Optional tone guidance...",
  "exampleContent": "Optional example content..."
}
```

**Response (POST /api/templates):**
```json
{
  "template": {
    "id": "uuid",
    "workspaceId": "workspace-id",
    "name": "My Custom Template",
    "slug": "my-custom-template",
    "templateType": "custom",
    "contentType": "blog_post",
    "description": "Custom template for technical posts",
    "structure": "...",
    "toneGuidance": "...",
    "exampleContent": "...",
    "isActive": true,
    "createdBy": "user-id",
    "usageCount": 0
  }
}
```

**Fallback behavior:** If database query fails, GET returns built-in templates only.

---

## 15. Other Endpoints

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/search` | GET | Session | Full-text search content & sessions |
| `/api/onboarding` | POST | Session | Complete onboarding flow |
| `/api/badge/[postId]` | GET | Public | Generate social badge for post |
| `/api/api-keys` | GET, POST | Session | Manage API keys |
| `/api/api-keys/[id]` | DELETE | Session | Revoke API key |
| `/api/skills/[id]` | GET, PUT, DELETE | Session | Manage writing skills |
| `/api/skills/import` | POST | Session | Import skills from external source |
| `/api/templates/[id]` | GET, PUT, DELETE | Session | Manage content templates |
| `/api/templates/analytics` | GET | Session | Get template usage stats |
| `/api/webhooks` | GET, POST | Session | Manage webhooks |
| `/api/webhooks/[id]` | DELETE | Session | Delete webhook |
| `/api/v1/webhooks` | GET, POST | API Key | Manage webhooks (public API) |
| `/api/v1/webhooks/[id]` | DELETE | API Key | Delete webhook (public API) |
| `/api/v1/openapi.json` | GET | Public | OpenAPI 3.0 schema for v1 API |
| `/api/feed/[...slug]` | GET | Public | RSS/Atom feed of published content |
| `/api/healthcheck` | GET | Public | Health check endpoint |
| `/api/recommendations/[id]` | GET | Session | Get content recommendation |
| `/api/recommendations/generate` | POST | Session | Generate recommendations |
| `/api/schedule` | GET, POST | Session | List, create scheduled publishes |
| `/api/schedule/[id]` | PUT, DELETE | Session | Update, delete scheduled publish |
| `/api/schedule/publish` | POST | Session | Publish scheduled content now |
| `/api/scan-sources` | GET, POST | Session | List, add SSH scan sources |
| `/api/scan-sources/[id]` | PUT, DELETE | Session | Update, delete source |
| `/api/scan-sources/[id]/check` | POST | Session | Test source connectivity |
| `/api/public/collections` | GET | Public | List published collections |
| `/api/activity` | GET | Session | Get global activity log |

---

## Error Codes

Common error codes returned by private API:

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | Session required or user not authenticated |
| `NOT_FOUND` | 404 | Resource not found or access denied |
| `BAD_REQUEST` | 400 | Invalid query parameters |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `QUOTA_EXCEEDED` | 402 | Monthly quota limit reached |

---

## Rate Limiting & Quotas

- API endpoints enforce monthly quotas on content generation via `checkQuota()`
- Exceeding quota returns `402 Payment Required` with quota details
- QStash endpoints validate request signatures and require `QSTASH_CURRENT_SIGNING_KEY`

---

## OpenAPI Schema

The complete OpenAPI 3.0 schema for the v1 public API is available at `/api/v1/openapi.json`.

---

**Last Updated:** March 2026
**Total Route Files:** 150+
