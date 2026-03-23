# External Integrations

**Analysis Date:** 2026-03-22

## AI

**Anthropic / Claude Agent SDK:**
- Purpose: All AI content generation — blog, social, newsletter, changelog, repurpose, editor chat, insight extraction
- SDK: `@anthropic-ai/claude-agent-sdk` (primary), `@anthropic-ai/sdk` (secondary)
- Auth: Inherits from Claude CLI logged-in session — zero API keys. `delete process.env.CLAUDECODE` required before every `query()` call
- Entry point: `apps/dashboard/src/lib/ai/agent-runner.ts`
- Pattern: `query()` with MCP server tools + system prompt, streamed via SSE
- Disable flag: `DISABLE_AI_AGENTS=true` env var gracefully disables all agent routes
- Agents: `apps/dashboard/src/lib/ai/agents/` — blog-writer, social-writer, newsletter-writer, changelog-writer, evidence-writer, recommendations-analyzer, content-strategist

## Data Storage

**Databases:**
- Provider: Neon (serverless PostgreSQL)
- Driver: `@neondatabase/serverless` ^0.10 — HTTP-based, works in edge/serverless
- ORM: Drizzle ORM ^0.39
- Schema: `packages/db/src/schema.ts` — single file defining 30+ tables
- Client: `apps/dashboard/src/lib/db.ts` (imported across all API routes as `import { db } from "@/lib/db"`)
- Migrations: `drizzle-kit push` / `drizzle-kit generate` from `packages/db`

**Caching:**
- Upstash Redis (HTTP-based, serverless): env vars `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN`
- Standard Redis via ioredis (TCP, self-hosted): env var `REDIS_URL`
- Wrapper: `apps/dashboard/src/lib/redis.ts` — auto-selects driver, returns `null` if neither configured
- Usage: caching, rate limiting, health checks

**File Storage:**
- Local filesystem only — no Vercel Blob or S3 detected
- Export packages (ZIP): generated in-memory via `jszip`, served as download

## Authentication & Identity

**Auth Provider:** Better Auth 1.2
- Server config: `apps/dashboard/src/lib/auth.ts`
- Client config: `apps/dashboard/src/lib/auth-client.ts`
- Database adapter: `@better-auth/drizzle-adapter` — maps to `users`, `authSessions`, `accounts`, `verifications` tables
- Strategies:
  - Email/password: always enabled with `autoSignIn: true`
  - GitHub OAuth: conditional — only enabled when `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set
- Session: cookie-cached, 5-minute cache window
- Plugin: `nextCookies()` for Next.js cookie handling
- Route: `apps/dashboard/src/app/api/auth/[...all]/route.ts`
- Required env: `BETTER_AUTH_URL` (server) or `NEXT_PUBLIC_APP_URL` (fallback)

**API Key Auth (internal users):**
- Implementation: `apps/dashboard/src/lib/auth/api-key.ts`
- Used for: public v1 API routes at `apps/dashboard/src/app/api/v1/`

## Billing

**Stripe:**
- SDK: `stripe` ^17
- Client: `apps/dashboard/src/lib/stripe.ts`
- Plans: solo_monthly, solo_annual, pro_monthly, pro_annual, team_monthly, team_annual
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SOLO_MONTHLY`, `STRIPE_PRICE_SOLO_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_TEAM_ANNUAL`
- Webhook: `apps/dashboard/src/app/api/stripe/webhook/route.ts`
- Checkout: `apps/dashboard/src/app/api/billing/checkout/route.ts`
- Portal: `apps/dashboard/src/app/api/billing/portal/route.ts`
- Subscription: `apps/dashboard/src/app/api/billing/subscription/route.ts`
- Helper: `getOrCreateStripeCustomer(userId, email)` — upserts Stripe customer ID to `subscriptions` table

## Queue / Background Jobs

**Upstash QStash:**
- SDK: `@upstash/qstash` ^2.7
- Client: `apps/dashboard/src/lib/qstash.ts`
- Env vars: `UPSTASH_QSTASH_TOKEN`, `UPSTASH_QSTASH_CURRENT_SIGNING_KEY`, `UPSTASH_QSTASH_NEXT_SIGNING_KEY`
- Uses: scheduled automation triggers (cron), file-watch triggers (every 5 min), one-time delayed publish jobs
- Fallback: when `UPSTASH_QSTASH_TOKEN` is not set, scheduled triggers fall back to Vercel Cron at `GET /api/cron/automation`
- Signature verification: `verifyQStashRequest()` validates `upstash-signature` header

**Vercel Cron:**
- Endpoint: `apps/dashboard/src/app/api/cron/automation/route.ts`
- Schedule: every 5 minutes in production
- Auth: `CRON_SECRET` env var validated against `Authorization: Bearer` header
- Purpose: polls all enabled `scheduled` triggers, fires `executePipeline()` for due ones

## Publishing Integrations

**Hashnode:**
- Client: `apps/dashboard/src/lib/publishing/hashnode.ts`
- API: GraphQL at `https://gql.hashnode.com`
- Auth: user-provided token (stored per-user in DB)
- Operations: `getHashnodePublications()`, `publishToHashnode()`
- Route: `apps/dashboard/src/app/api/integrations/` (managed via settings)

**WordPress:**
- Client: `apps/dashboard/src/lib/wordpress/client.ts` — `WordPressClient` class
- API: WordPress REST API v2 (`/wp-json/wp/v2`)
- Auth: HTTP Basic with Application Password (`username:app_password` Base64)
- Supports: self-hosted WordPress.org and WordPress.com
- Operations: `testConnection()`, `getCategories()`, `getTags()`, `createPost()`
- Credentials encrypted: `apps/dashboard/src/lib/wordpress/crypto.ts`

**Dev.to:**
- Client: `apps/dashboard/src/lib/integrations/devto.ts`
- API: REST at `https://dev.to/api`
- Auth: `api-key` header with user-provided API key
- Operations: `verifyDevtoApiKey()`, `publishToDevto()`, `updateDevtoArticle()`
- Route: `apps/dashboard/src/app/api/integrations/devto/route.ts`

**Ghost:**
- Client: `apps/dashboard/src/lib/integrations/ghost.ts`
- API: Ghost Admin API v5 (`/ghost/api/admin`)
- Auth: JWT generated from `{id}:{secret}` Admin API key format (5-min expiry)
- Operations: `verifyGhostApiKey()`, `publishToGhost()`, `updateGhostPost()`
- Route: `apps/dashboard/src/app/api/integrations/ghost/route.ts`

**Medium:**
- Client: `apps/dashboard/src/lib/integrations/medium.ts`
- API: REST at `https://api.medium.com/v1`
- Auth: Bearer token; OAuth 2.0 flow (`getOAuthUrl()`, `exchangeCodeForToken()`)
- Operations: `verifyMediumToken()`, `getMediumPublications()`, `publishToMedium()`, `publishToMediumPublication()`

## Social / Analytics Integrations

**GitHub:**
- Client: `apps/dashboard/src/lib/integrations/github.ts`
- API: REST at `https://api.github.com` (version `2022-11-28`)
- Auth: `Authorization: Bearer {accessToken}` (user-provided OAuth token)
- Operations: `verifyGitHubToken()`, `fetchGitHubRepositories()`, `fetchGitHubCommits()`, `fetchGitHubPullRequests()`, `fetchGitHubIssues()`, `fetchGitHubRepository()`
- Error types: `invalid_token`, `not_found`, `forbidden`, `rate_limited`, `validation_error`
- Routes: `apps/dashboard/src/app/api/integrations/github/` (connect, repos, activity, privacy, webhooks)

**Twitter / X:**
- Client: `apps/dashboard/src/lib/integrations/twitter.ts`
- API: Twitter API v2 at `https://api.twitter.com/2`
- Auth: Bearer token (user OAuth token)
- Operations: `verifyTwitterAuth()`, `getTweetAnalytics()`, `getTweetById()`
- Used for: analytics sync (`apps/dashboard/src/app/api/analytics/social/`)

**LinkedIn:**
- Client: `apps/dashboard/src/lib/integrations/linkedin.ts`
- API: LinkedIn v2 at `https://api.linkedin.com/v2`
- Auth: Bearer token with `X-Restli-Protocol-Version: 2.0.0`
- Operations: `verifyLinkedInAuth()`, `getLinkedInPostAnalytics()`, `getLinkedInPostById()`
- Used for: analytics sync

## Webhooks

**Outgoing (user-configured webhooks):**
- Delivery: `apps/dashboard/src/lib/webhooks/deliver.ts`
- Signature: `X-SessionForge-Signature: sha256=<hmac>` (HMAC-SHA256, per-endpoint secret)
- Event header: `X-SessionForge-Event: <eventType>`
- Timeout: 5 seconds per delivery; errors swallowed (non-blocking)
- Events defined: `apps/dashboard/src/lib/webhooks/events.ts`
- Management: `apps/dashboard/src/app/api/v1/webhooks/route.ts` + `[id]/route.ts`

**Incoming (GitHub webhooks):**
- Route: `apps/dashboard/src/app/api/integrations/github/webhooks/route.ts`

**Incoming (QStash callbacks):**
- Routes: `apps/dashboard/src/app/api/automation/execute/route.ts`, `apps/dashboard/src/app/api/automation/file-watch/route.ts`, `apps/dashboard/src/app/api/schedule/publish/route.ts`
- Validation: `verifyQStashRequest()` — checks `upstash-signature` header

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from Vercel Cron usage, `vercel.json` not present — uses Next.js defaults)
- Next.js `output: "standalone"` enables Docker deployment as alternative

**CI Pipeline:**
- Not detected (no `.github/workflows/` or similar explored)

## Public API

**REST API v1:**
- Base: `/api/v1/`
- Routes: content CRUD, sessions, insights, webhooks, scan
- Auth: API key (`apps/dashboard/src/lib/auth/api-key.ts`)
- OpenAPI spec: `apps/dashboard/src/app/api/v1/openapi.json/route.ts`

**Public routes (unauthenticated):**
- Portfolio: `GET /api/public/portfolio/[workspace]`
- Collections: `GET /api/public/collections/[workspace]/[slug]`
- RSS feed: `GET /api/public/portfolio/[workspace]/rss`
- Attribution badge: `GET /api/badge/[postId]`
- RSS/Atom feed: `GET /api/feed/[...slug]`

## Environment Variable Summary

| Variable | Service | Required |
|---|---|---|
| `DATABASE_URL` / Neon connection | Neon Postgres | Yes |
| `BETTER_AUTH_URL` | Better Auth (server) | Production |
| `NEXT_PUBLIC_APP_URL` | App base URL | Yes |
| `STRIPE_SECRET_KEY` | Stripe | Billing |
| `STRIPE_PRICE_*` (6 vars) | Stripe price IDs | Billing |
| `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` | Upstash Redis | Cache |
| `REDIS_URL` | Self-hosted Redis (alt) | Cache alt |
| `UPSTASH_QSTASH_TOKEN` | QStash | Scheduling |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | QStash | Scheduling |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | QStash | Scheduling |
| `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` | GitHub OAuth | Optional |
| `CRON_SECRET` | Vercel Cron | Production |
| `DISABLE_AI_AGENTS` | AI kill switch | Optional |

---

*Integration audit: 2026-03-22*
