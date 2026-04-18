# Self-Hosted Deployment Guide

**Version:** 0.5.2-alpha

---

## 1. Overview

**BYO (Bring Your Own) Infrastructure mode** lets you run SessionForge on your own servers using your own PostgreSQL database and optionally your own Redis instance — with no dependency on Neon, Upstash, or Vercel.

This deployment mode is designed for teams and individuals who want:

- **Full data ownership** — all session data, content, and AI outputs stay in your database
- **Air-gapped or private-cloud deployments** — no outbound connections to managed cloud services
- **Cost control** — use existing database infrastructure rather than paying per-query
- **Customization** — modify the stack, add extensions, configure backups on your own terms

### Who This Is For

| Use case | Recommended? |
|---|---|
| Teams with existing Postgres infra | ✅ Yes |
| Enterprises with data residency requirements | ✅ Yes |
| Developers who want full control | ✅ Yes |
| Quick prototyping / demo | Consider Vercel + Neon instead |
| Users who don't manage servers | Consider Vercel + Neon instead |

---

## 2. Prerequisites

### Required

| Requirement | Minimum Version | Notes |
|---|---|---|
| Docker + Docker Compose | Docker 24+, Compose v2 | For Docker deployment |
| PostgreSQL | 14+ | 16 recommended; included in compose template |
| Bun | **1.2.4+** | Package manager (required for manual installation; Next.js runs on Node-compatible runtime) |

### Optional

| Requirement | Minimum Version | Purpose |
|---|---|---|
| Redis | 6+ | Session caching, rate limiting, background jobs |
| Claude CLI | Latest | Required for AI content generation features |

### Network Requirements

The application needs to reach:
- Your PostgreSQL instance (default port 5432)
- Your Redis instance, if configured (default port 6379)
- Outbound HTTPS for OAuth callbacks (GitHub, Google, etc.) if enabled

---

## 3. Quick Start (Docker Compose)

The fastest path to a running self-hosted instance uses the included `docker-compose.self-hosted.yml` template, which bundles PostgreSQL 16 and Redis 7.

### Step 1 — Copy the template

```bash
cp docker-compose.self-hosted.yml docker-compose.override.yml
```

Or use it directly with the `-f` flag in subsequent commands.

### Step 2 — Generate a secret and configure environment

```bash
# Generate a strong auth secret
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"

# Set your public URL (update for production)
export BETTER_AUTH_URL="http://localhost:3000"
export NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

For a persistent configuration, create a `.env` file:

```bash
cat > .env <<EOF
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: change DB credentials
POSTGRES_USER=sessionforge
POSTGRES_PASSWORD=sessionforge
POSTGRES_DB=sessionforge
EOF
```

### Step 3 — Start the stack

```bash
docker compose -f docker-compose.self-hosted.yml up -d
```

This starts three services:
- **postgres** — PostgreSQL 16 on port 5432 with persistent volume
- **redis** — Redis 7 on port 6379 with append-only persistence
- **app** — SessionForge on port 3000 (waits for healthy DB and Redis)

### Step 4 — Run database migrations

After the app container starts, push the Drizzle schema to the database:

```bash
docker compose -f docker-compose.self-hosted.yml exec app \
  bunx drizzle-kit push
```

Alternatively, if you have Bun installed locally with `DATABASE_URL` pointing to your DB:

```bash
cd apps/dashboard
bunx drizzle-kit push
```

### Step 5 — Verify the deployment

Visit the validation endpoint to confirm all services are connected:

```bash
curl http://localhost:3000/api/deployment/validate | jq
```

A healthy deployment returns HTTP 200:

```json
{
  "status": "ok",
  "mode": "self-hosted",
  "checks": {
    "required": {
      "DATABASE_URL": { "present": true },
      "BETTER_AUTH_SECRET": { "present": true },
      "NEXT_PUBLIC_APP_URL": { "present": true }
    },
    "db": { "ok": true },
    "redis": { "configured": true, "ok": true }
  },
  "timestamp": "2026-03-19T00:00:00.000Z"
}
```

If `status` is `"degraded"`, see the [Troubleshooting](#8-troubleshooting) section.

---

## 4. Manual Installation (Non-Docker)

If you prefer to run SessionForge directly on a host without Docker:

### Step 1 — Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### Step 2 — Clone and install dependencies

```bash
git clone https://github.com/your-org/sessionforge.git
cd sessionforge
bun install
```

### Step 3 — Configure environment variables

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

Edit `apps/dashboard/.env.local` with your values. At minimum:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sessionforge
BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
BETTER_AUTH_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Step 4 — Push the database schema

```bash
cd apps/dashboard
bunx drizzle-kit push
```

### Step 5 — Build and start the application

```bash
# Build the Next.js app
bun run build

# Start in production mode
bun run start
```

The app listens on port 3000 by default. Use a reverse proxy (nginx, Caddy, Traefik) to terminate TLS and forward traffic.

### Step 6 — Verify

```bash
curl http://localhost:3000/api/deployment/validate | jq
```

---

## 5. Environment Variable Reference

### Required Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `BETTER_AUTH_SECRET` | **Yes** | — | Secret key for session encryption. Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | **Yes** | — | Canonical URL of your deployment (e.g., `https://app.example.com`) |
| `NEXT_PUBLIC_APP_URL` | **Yes** | — | Same as `BETTER_AUTH_URL`. Used for client-side URL construction |

### Database Options

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_DRIVER` | No | `postgres` | Database driver. Set to `postgres` for standard PostgreSQL |

### Redis / Cache (Auto-Selected)

The app auto-selects a Redis client based on available env vars:

| Variable | Required | Default | Description |
|---|---|---|---|
| `UPSTASH_REDIS_URL` | No (unless using Upstash) | — | Upstash Redis REST URL (HTTP, serverless). Requires `UPSTASH_REDIS_TOKEN` |
| `UPSTASH_REDIS_TOKEN` | No (unless using Upstash) | — | Upstash Redis REST token. Required with `UPSTASH_REDIS_URL` |
| `REDIS_URL` | No (unless self-hosting) | — | Self-hosted Redis TCP URL (e.g., `redis://host:6379`). Used only if `UPSTASH_REDIS_URL` is NOT set |

**Selection logic:** If `UPSTASH_REDIS_URL+UPSTASH_REDIS_TOKEN` are set, use @upstash/redis (HTTP). Else if `REDIS_URL` is set, use ioredis (TCP). Else caching is disabled (app continues with degraded performance).

> **Note:** If all Redis variables are unset, the app still runs but with no caching. Rate limiting and session caching are disabled. This is acceptable for development or low-traffic deployments.

### Background Jobs / Queue

| Variable | Required | Default | Description |
|---|---|---|---|
| `QUEUE_URL` | No | — | Custom queue URL. Defaults to Redis if `REDIS_URL` is set |
| `UPSTASH_QSTASH_TOKEN` | No | — | Upstash QStash token for managed job scheduling |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | No | — | QStash webhook verification key (current) |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | No | — | QStash webhook verification key (next rotation) |

### OAuth Integrations

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_CLIENT_ID` | No | — | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No | — | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth 2.0 client secret |
| `TWITTER_CLIENT_ID` | No | — | Twitter/X OAuth 2.0 client ID |
| `TWITTER_CLIENT_SECRET` | No | — | Twitter/X OAuth 2.0 client secret |
| `LINKEDIN_CLIENT_ID` | No | — | LinkedIn OAuth client ID |
| `LINKEDIN_CLIENT_SECRET` | No | — | LinkedIn OAuth client secret |
| `MEDIUM_CLIENT_ID` | No | — | Medium OAuth client ID |
| `MEDIUM_CLIENT_SECRET` | No | — | Medium OAuth client secret |
| `MEDIUM_REDIRECT_URI` | No | — | Medium OAuth redirect URL |

### Billing (Stripe)

| Variable | Required | Default | Description |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | No | — | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhook endpoint secret |
| `STRIPE_PRICE_SOLO_MONTHLY` | No | — | Stripe Price ID for Solo monthly plan |
| `STRIPE_PRICE_SOLO_ANNUAL` | No | — | Stripe Price ID for Solo annual plan |
| `STRIPE_PRICE_PRO_MONTHLY` | No | — | Stripe Price ID for Pro monthly plan |
| `STRIPE_PRICE_PRO_ANNUAL` | No | — | Stripe Price ID for Pro annual plan |
| `STRIPE_PRICE_TEAM_MONTHLY` | No | — | Stripe Price ID for Team monthly plan |
| `STRIPE_PRICE_TEAM_ANNUAL` | No | — | Stripe Price ID for Team annual plan |

### Feature Flags & Security

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISABLE_AI_AGENTS` | No | `false` | Set to `"true"` to gracefully disable all AI agent features. Endpoints return user-friendly errors. Use in development or when Claude CLI is unavailable. |
| `DISABLE_OBSERVABILITY` | No | `false` | Set to `"true"` to disable the observability event bus (run logs, SSE streaming) |
| `SCAN_SOURCE_ENCRYPTION_KEY` | No | (auto-generated) | AES-256 encryption key for encrypting SSH scan source credentials. Base64-encoded 32-byte key. Generate: `openssl rand -base64 32` |
| `DEPLOYMENT_VALIDATE_TOKEN` | No | — | Bearer token for `/api/deployment/validate` endpoint access. Leave unset to allow unauthenticated access (useful for health checks) |

---

## 6. Feature Parity

| Feature | Self-Hosted (BYO) | Neon-Managed (Vercel) | Vercel Only |
|---|---|---|---|
| Content management | ✅ Full | ✅ Full | ✅ Full |
| Publishing (Markdown/MDX export) | ✅ Full | ✅ Full | ✅ Full |
| OAuth login (GitHub, Google, etc.) | ✅ With config | ✅ With config | ✅ With config |
| Session scanning (`~/.claude/`) | ✅ With local mount | ❌ No filesystem | ❌ No filesystem |
| AI content generation | ✅ With Claude CLI | ✅ With Claude CLI | ❌ Serverless limitation |
| AI insight extraction | ✅ With Claude CLI | ✅ With Claude CLI | ❌ Serverless limitation |
| Redis caching | ✅ Self-hosted Redis | ✅ Upstash | ✅ Upstash |
| Background job queue | ✅ Redis or QStash | ✅ QStash | ✅ QStash |
| Stripe billing | ✅ With config | ✅ With config | ✅ With config |
| Vercel Cron integration | ❌ Not applicable | ✅ Built-in | ✅ Built-in |
| Database branching (Neon) | ❌ Not applicable | ✅ Built-in | ❌ Not applicable |
| Deployment validation endpoint | ✅ `/api/deployment/validate` | ✅ `/api/deployment/validate` | ✅ `/api/deployment/validate` |

> **Self-hosted provides full feature parity with the Neon-managed deployment** when the Claude CLI is installed and authenticated. The only features not available are Vercel-specific platform integrations (Cron, Neon database branching).

---

## 7. Enabling AI Features

AI features (content generation, insight extraction, session mining) require the Claude CLI installed and authenticated inside the environment where the app runs.

### Check Current Status

```bash
curl http://localhost:3000/api/deployment/validate | jq '.checks'
```

When `DISABLE_AI_AGENTS` is `"true"` or unset with no CLI available, AI routes return a graceful error. The rest of the app continues to work normally.

### Install the Claude CLI

```bash
npm install -g @anthropic-ai/claude-code
```

Verify installation:

```bash
claude --version
```

### Authenticate

```bash
claude auth login
```

Follow the browser prompt to authenticate with your Anthropic account.

### Enable AI in Docker

To use AI features in the Docker deployment, the Claude CLI credentials must be available inside the container. The recommended approach is to mount your host credentials:

```yaml
# In your docker-compose override
services:
  app:
    environment:
      DISABLE_AI_AGENTS: "false"
    volumes:
      - ~/.claude:/home/nextjs/.claude:ro
```

Then rebuild and restart:

```bash
docker compose -f docker-compose.self-hosted.yml up -d --build
```

### Enable AI in Manual Installation

Set `DISABLE_AI_AGENTS` to `"false"` (or remove it) in your `.env.local`, then restart the application. The app inherits the Claude CLI session from the host user automatically.

---

## 8. Troubleshooting

### Using the Validation Endpoint

Always start troubleshooting by checking the validation endpoint:

```bash
curl -s http://localhost:3000/api/deployment/validate | jq
```

The response shows:
- `status`: `"ok"` or `"degraded"`
- `mode`: detected deployment mode (`"self-hosted"`, `"neon-managed"`, or `"vercel"`)
- `checks.required`: which required env vars are present
- `checks.db.ok`: whether the database connection succeeded
- `checks.redis`: whether Redis is configured and reachable

If `DEPLOYMENT_VALIDATE_TOKEN` is set, pass it as a Bearer token:

```bash
curl -H "Authorization: Bearer $DEPLOYMENT_VALIDATE_TOKEN" \
  http://localhost:3000/api/deployment/validate | jq
```

---

### Common Errors and Fixes

#### `status: "degraded"` — Database connection failed

**Symptom:** `checks.db.ok` is `false` with a connection error.

**Fixes:**
1. Verify `DATABASE_URL` is correct: `postgresql://user:pass@host:5432/dbname`
2. Check PostgreSQL is running: `docker compose -f docker-compose.self-hosted.yml ps`
3. Confirm the app container can reach the DB host (same Docker network, firewall rules)
4. Run `bunx drizzle-kit push` if migrations haven't been applied yet

#### Missing required environment variables

**Symptom:** `checks.required.BETTER_AUTH_SECRET.present` is `false`.

**Fix:** Ensure all required variables are set in `.env` or passed as environment variables before starting the app.

#### App starts but returns 500 on all routes

**Cause:** Missing database migrations — the schema hasn't been pushed.

**Fix:**
```bash
docker compose -f docker-compose.self-hosted.yml exec app bunx drizzle-kit push
```

#### Redis connection refused

**Symptom:** `checks.redis.ok` is `false` with `ECONNREFUSED`.

**Fixes:**
1. Verify Redis is running: `docker compose -f docker-compose.self-hosted.yml ps redis`
2. Check `REDIS_URL` format: `redis://hostname:6379` (no trailing slash)
3. If Redis is optional for your use case, this warning can be ignored — the app continues without it

#### AI features return errors

**Symptom:** Content generation endpoints return `"AI agents are disabled"`.

**Fix:**
1. Confirm `DISABLE_AI_AGENTS` is not set to `"true"`
2. Verify Claude CLI is installed: `claude --version`
3. Verify authentication: `claude auth status`
4. For Docker: confirm credentials are mounted correctly (see [Enabling AI Features](#7-enabling-ai-features))

#### Port 3000 already in use

**Fix:** Change the host port in your compose override:
```yaml
services:
  app:
    ports:
      - "8080:3000"  # Use port 8080 on the host
```

Or set `PORT=8080` in your `.env`.

#### `openssl rand -base64 32` not available on Windows

**Fix:** Use PowerShell:
```powershell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

### Getting Help

- **Deployment validation:** `GET /api/deployment/validate`
- **Health check:** `GET /api/healthcheck`
- **GitHub Issues:** [github.com/your-org/sessionforge/issues](https://github.com/your-org/sessionforge/issues)
