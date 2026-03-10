# SessionForge Deployment Guide

**Version:** 0.5.1-alpha

---

## Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Vercel CLI](https://vercel.com/docs/cli) (optional, for local preview)
- A [Neon](https://neon.tech/) PostgreSQL database
- A [Vercel](https://vercel.com/) account for hosting

---

## Vercel Deployment

SessionForge deploys as a Next.js 15 application on Vercel. The monorepo build is configured in `vercel.json` at the project root.

### Build Configuration

| Setting | Value |
|---|---|
| Framework | Next.js |
| Install Command | `bun install` |
| Build Command | `cd apps/dashboard && bun run build` |
| Output Directory | `apps/dashboard/.next` |
| Region | `iad1` (US East) |

### Function Timeouts

Long-running AI agent routes have extended timeouts (300s / 5 min):

- `/api/agents/**` -- content generation agents
- `/api/content/mine-sessions/**` -- session mining
- `/api/sessions/scan/**` -- session scanning
- `/api/insights/extract/**` -- insight extraction

### Cron Jobs

A single Vercel Cron is configured to run automation triggers every 5 minutes:

```
/api/cron/automation  →  */5 * * * *
```

This endpoint requires a `CRON_SECRET` environment variable for verification.

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployment (e.g., `https://app.sessionforge.dev`) |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth session encryption |
| `CRON_SECRET` | Vercel Cron job verification secret |

### Upstash (Queue and Cache)

| Variable | Description |
|---|---|
| `UPSTASH_QSTASH_TOKEN` | QStash API token for scheduled job execution |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | QStash webhook verification (current key) |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | QStash webhook verification (next rotation key) |
| `UPSTASH_REDIS_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_TOKEN` | Upstash Redis REST token |

### Stripe (Billing)

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint secret |
| `STRIPE_PRICE_SOLO_MONTHLY` | Stripe Price ID for Solo monthly plan |
| `STRIPE_PRICE_SOLO_ANNUAL` | Stripe Price ID for Solo annual plan |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for Pro monthly plan |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe Price ID for Pro annual plan |
| `STRIPE_PRICE_TEAM_MONTHLY` | Stripe Price ID for Team monthly plan |
| `STRIPE_PRICE_TEAM_ANNUAL` | Stripe Price ID for Team annual plan |

### OAuth Integrations (Optional)

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook verification secret |
| `TWITTER_CLIENT_ID` | Twitter/X OAuth 2.0 client ID |
| `TWITTER_CLIENT_SECRET` | Twitter/X OAuth 2.0 client secret |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth client secret |
| `MEDIUM_CLIENT_ID` | Medium OAuth client ID |
| `MEDIUM_CLIENT_SECRET` | Medium OAuth client secret |
| `MEDIUM_REDIRECT_URI` | Medium OAuth callback URL |

### Feature Flags (Optional)

| Variable | Description |
|---|---|
| `DISABLE_AI_AGENTS` | Set to `"true"` to disable all AI agent features |
| `DISABLE_OBSERVABILITY` | Set to `"true"` to disable observability event bus |
| `SCAN_SOURCE_ENCRYPTION_KEY` | AES key for encrypting SSH scan source credentials |

### AI Authentication

SessionForge uses `@anthropic-ai/claude-agent-sdk` which inherits authentication from the Claude CLI session. **No `ANTHROPIC_API_KEY` is needed.** The SDK spawns the `claude` CLI subprocess, which uses the logged-in user's credentials automatically.

---

## Database Setup

1. Create a Neon PostgreSQL database at [neon.tech](https://neon.tech/).
2. Copy the connection string to the `DATABASE_URL` environment variable.
3. Push the schema using Drizzle Kit:

```bash
cd apps/dashboard
bunx drizzle-kit push
```

The schema is defined in `packages/db/src/schema.ts`. See [database-guide.md](./database-guide.md) for full schema documentation.

**Note:** `drizzle-kit push` may hang on interactive prompts for new enums or columns. If this happens, use direct SQL `ALTER TABLE` statements as a workaround.

---

## Local Development

```bash
# Install dependencies
bun install

# Start the dev server (port 3000)
cd apps/dashboard && bun run dev
```

Use `next dev` (not `next dev --turbopack`). Turbopack has known issues with `drizzle-orm` relations resolving to `undefined` and broken workspace symlinks in bun monorepos.

After modifying API routes or schema, restart the dev server to clear stale caches.

---

## Middleware

The Next.js middleware (`src/middleware.ts`) handles legacy route redirects:

- `/:ws/series` → `/:ws/content?filter=series`
- `/:ws/collections` → `/:ws/content?filter=collections`
- `/:ws/recommendations` → `/:ws/insights`
- `/:ws/settings/:sub` → `/:ws/settings?tab=:sub`

All redirects are 308 (permanent). API and `_next` routes are excluded.

---

## Domain and DNS

1. Add your custom domain in Vercel project settings.
2. Set DNS records as directed by Vercel (typically a CNAME to `cname.vercel-dns.com`).
3. Update `NEXT_PUBLIC_APP_URL` to match your domain.
4. Update OAuth redirect URIs for any configured integrations.

---

**Last Updated:** March 2026
