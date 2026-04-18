# SessionForge Deployment Guide

**Version:** 0.5.2-alpha

---

## Local Development

### Quick Start (Docker Compose)

```bash
# Clone and install
git clone https://github.com/nick/sessionforge.git
cd sessionforge

# Start with local PostgreSQL
docker compose up

# Database starts at localhost:5432
# App runs at http://localhost:3000
```

**Credentials (Local):**
- Database: `sessionforge` / `sessionforge`
- Auth: Email/password signup available

**Env vars (auto-set by compose):**
- `DATABASE_URL`: `postgresql://sessionforge:sessionforge@postgres:5432/sessionforge`
- `BETTER_AUTH_SECRET`: `dev-secret-change-in-production`
- `NEXT_PUBLIC_APP_URL`: `http://localhost:3000`
- `DISABLE_AI_AGENTS`: `true` (disables AI features gracefully — required for local Docker without Claude CLI mounted)
- `SCAN_SOURCE_ENCRYPTION_KEY`: Optional, auto-generated if unset (AES encryption key for SSH scan source credentials)

### Manual Setup

**Requirements:** Bun 1.2.4+ (package manager), Node.js 20+ (Next.js runtime compatibility)

```bash
# Install dependencies (Bun is required, not npm)
bun install

# Setup database
cp .env.example .env.local
# Edit .env.local with:
#   DATABASE_URL=postgresql://user:pass@localhost:5432/sessionforge
#   BETTER_AUTH_SECRET=dev-random-secret
#   DISABLE_AI_AGENTS=true (optional — disable for local dev)

# Push schema
bun run db:push

# Start dev server
bun run dev
# Runs on http://localhost:3000
```

**Critical:** Always use `next dev` (NOT `next dev --turbopack`). Turbopack has drizzle-orm relation resolution bugs in bun monorepos. Restart the dev server after ANY route or schema changes to clear stale caches (stale caches cause false 500 errors even after fixes are applied).

---

## Vercel Deployment

SessionForge deploys as a Next.js 15 application on Vercel. The monorepo build is configured in `vercel.json` at the project root.

### ### Docker Production

Deploy to your own infrastructure (self-hosted, cloud VMs, Kubernetes):

```bash
# Build image
docker build -t sessionforge:latest .

# Run with Neon database
export DATABASE_URL="postgresql://user:pass@neon-endpoint/sessionforge"
export BETTER_AUTH_SECRET="your-secret-key"
export BETTER_AUTH_URL="https://yourdomain.com"

docker run -p 3000:3000 \
  -e DATABASE_URL \
  -e BETTER_AUTH_SECRET \
  -e BETTER_AUTH_URL \
  -e NEXT_PUBLIC_APP_URL="https://yourdomain.com" \
  sessionforge:latest
```

Or with docker-compose for production (Neon backend):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Update env vars in `.env` before running:
- `DATABASE_URL` — Neon connection (not local Postgres)
- `BETTER_AUTH_SECRET` — Strong random key
- `BETTER_AUTH_URL` — Your domain
- All Upstash and Stripe credentials

Image runs as non-root user (nextjs:1001). Health check polls `/api/healthcheck`.

### Vercel Build Configuration

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

### Upstash & Redis (Queue and Cache)

**Redis (auto-selected):**

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_URL` | Upstash Redis REST URL (HTTP-based, serverless) |
| `UPSTASH_REDIS_TOKEN` | Upstash Redis REST token (required with `UPSTASH_REDIS_URL`) |
| `REDIS_URL` | Self-hosted Redis TCP URL (e.g., `redis://localhost:6379`). Used only if `UPSTASH_REDIS_URL` is not set |

The client auto-selects: `UPSTASH_REDIS_URL+UPSTASH_REDIS_TOKEN` → @upstash/redis; else `REDIS_URL` → ioredis; else caching disabled.

**QStash (Scheduled Jobs):**

| Variable | Description |
|---|---|
| `UPSTASH_QSTASH_TOKEN` | QStash API token for scheduled job execution |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | QStash webhook verification (current rotation key) |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | QStash webhook verification (next rotation key) |

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

### Feature Flags & Security (Optional)

| Variable | Default | Description |
|---|---|---|
| `DISABLE_AI_AGENTS` | `false` | Set to `"true"` to gracefully disable all AI agent features (content generation, insight extraction, chat). Endpoints return user-friendly errors. Used in local Docker dev to avoid requiring Claude CLI. |
| `DISABLE_OBSERVABILITY` | `false` | Set to `"true"` to disable the observability event bus (run logs, SSE streaming) |
| `SCAN_SOURCE_ENCRYPTION_KEY` | (auto-generated) | AES-256 encryption key for encrypting SSH scan source credentials (Neon database, self-hosted, or Docker). Format: base64-encoded 32-byte key. Generate: `openssl rand -base64 32` |

### AI Authentication (Zero API Key Configuration)

SessionForge uses `@anthropic-ai/claude-agent-sdk` which inherits authentication from the Claude CLI session. **There are NO API keys to configure.**

The SDK spawns the `claude` CLI subprocess, which uses the logged-in user's credentials automatically. To enable AI features in production:
1. Install Claude CLI in the runtime environment: `npm install -g @anthropic-ai/claude-code`
2. Authenticate: `claude auth login`
3. Ensure `DISABLE_AI_AGENTS` is NOT set to `"true"`

**Important (Local Development):** The dev server inherits the `CLAUDECODE` environment variable from the parent Claude Code session, which causes nested agent rejections. All agent SDK files (12 total) include `delete process.env.CLAUDECODE` before spawning agents. This is required for local development. Alternatively, set `DISABLE_AI_AGENTS=true` in `.env.local`.

**Never Set ANTHROPIC_API_KEY:** This project uses claude-agent-sdk, NOT @anthropic-ai/sdk. Any ANTHROPIC_API_KEY env vars are ignored and should be removed.

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
