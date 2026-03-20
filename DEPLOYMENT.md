# Deployment

## Deployment Options

| Target | AI Features | Session Scanning | Best For |
|--------|-------------|-----------------|----------|
| Vercel | No (serverless limitation) | No (no filesystem) | Content management, viewing, publishing |
| Docker (cloud) | With Claude CLI | No (no local sessions) | Self-hosted with AI generation |
| Docker (local) | With Claude CLI | Yes | Full functionality |
| Docker (no CLI) | Gracefully disabled | Depends on mount | Content management without AI |

> **Self-hosting with your own infrastructure?** See the comprehensive [Self-Hosted Deployment Guide](docs/self-hosted.md) for BYO PostgreSQL/Redis setup, feature parity table, and AI configuration.

---

## Vercel Deployment

### Prerequisites

- GitHub repository
- [Vercel](https://vercel.com) account
- [Neon](https://neon.tech) PostgreSQL database

### Steps

1. **Push to GitHub**

2. **Import to Vercel**
   - Vercel auto-detects the Turborepo monorepo
   - Framework: Next.js
   - Root directory: `apps/dashboard`

3. **Configure environment variables** in the Vercel dashboard:

   | Variable | Required | Notes |
   |----------|----------|-------|
   | `DATABASE_URL` | Yes | Neon connection string |
   | `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | Yes | Your Vercel URL |
   | `NEXT_PUBLIC_APP_URL` | Yes | Same as BETTER_AUTH_URL |
   | `UPSTASH_REDIS_URL` | Recommended | Caching |
   | `UPSTASH_REDIS_TOKEN` | Recommended | — |
   | `GITHUB_CLIENT_ID` | Optional | OAuth login |
   | `GITHUB_CLIENT_SECRET` | Optional | — |
   | `STRIPE_SECRET_KEY` | Optional | Billing |
   | `STRIPE_WEBHOOK_SECRET` | Optional | — |

4. **Deploy**

5. **Update GitHub OAuth callback** (if using):
   `https://your-app.vercel.app/api/auth/callback/github`

### Limitations

- **AI generation will NOT work** — the Claude CLI subprocess cannot be spawned in serverless functions
- **Session scanning will NOT work** — no filesystem access to `~/.claude/`
- **`vercel.json`** extends function timeout to 300s for agent routes (future-proofing)

---

## Docker Deployment

### Prerequisites

- Docker and Docker Compose
- PostgreSQL database (local via Compose, or Neon)

### Local Development

```bash
# Start with local Postgres (AI features disabled)
docker compose up -d

# App available at http://localhost:3000
```

This starts:
- **postgres**: PostgreSQL 16 on port 5432
- **app**: SessionForge on port 3000 with `DISABLE_AI_AGENTS=true`

### Production

```bash
# Set environment variables
export DATABASE_URL="postgresql://user:pass@host/sessionforge"
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
export NEXT_PUBLIC_APP_URL="https://your-domain.com"
# ... set other variables as needed

# Start with production config
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Enabling AI Features in Docker

To enable AI features, the Claude CLI must be available and authenticated inside the container:

1. Install the Claude CLI in a custom Dockerfile layer
2. Mount credentials or authenticate interactively
3. Set `DISABLE_AI_AGENTS=false` (or remove the variable)

When `DISABLE_AI_AGENTS=true`:
- All AI API routes return graceful error messages
- The UI shows error state when AI features are attempted
- Content management, editing, and publishing continue to work

### Docker Build Details

The Dockerfile uses a 3-stage build:

1. **deps** (`oven/bun:1.2.4-slim`): Install dependencies with frozen lockfile
2. **builder** (`oven/bun:1.2.4-slim`): Build the Next.js application
3. **runner** (`node:20-slim`): Run the standalone output as non-root user

```bash
# Manual build
docker build -t sessionforge .

# Verify non-root execution
docker run --rm sessionforge whoami
# Output: nextjs
```

### Health Check

The container includes a health check hitting `/api/healthcheck`:

```bash
docker inspect --format='{{.State.Health.Status}}' <container-id>
```

---

## Neon Database Setup

### Create Database

1. Sign up at [neon.tech](https://neon.tech)
2. Create a project named `sessionforge`
3. Copy the connection string → `DATABASE_URL`

### Branching Strategy

| Neon Branch | Purpose |
|-------------|---------|
| `main` | Production database |
| `dev` | Development (branched from main) |
| `preview/*` | PR preview databases (optional) |

### Migration Workflow

```bash
# Development: push schema directly
bun db:push

# Production: generate and apply migrations
bun db:generate                              # Creates SQL files in packages/db/migrations/
cd packages/db && bunx drizzle-kit migrate   # Apply to production
```

### Connection Pooling

Neon's `@neondatabase/serverless` driver handles connection pooling automatically via HTTP. No PgBouncer or external pooler needed.

---

## Environment Variable Checklist

### All Environments

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes |
| `BETTER_AUTH_SECRET` | Yes |
| `NEXT_PUBLIC_APP_URL` | Yes |

### Production Additions

| Variable | Required |
|----------|----------|
| `BETTER_AUTH_URL` | Yes |
| `UPSTASH_REDIS_URL` | Recommended |
| `UPSTASH_REDIS_TOKEN` | Recommended |
| `UPSTASH_QSTASH_TOKEN` | For automation |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | For automation |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | For automation |

### Optional (All Environments)

| Variable | Purpose |
|----------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `STRIPE_SECRET_KEY` | Billing |
| `STRIPE_WEBHOOK_SECRET` | Billing webhooks |
| `DISABLE_AI_AGENTS` | Set `true` to disable AI |
