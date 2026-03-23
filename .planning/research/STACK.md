# Technology Stack: Containerization & Deployment

**Project:** SessionForge v0.1.0-alpha
**Scope:** Docker containerization, Vercel+Neon deployment, local dev environment, CI pipeline
**Researched:** 2026-03-22

## Recommended Stack

### Docker Images

| Technology | Version/Tag | Purpose | Why |
|------------|-------------|---------|-----|
| `oven/bun:1.2.4-slim` | 1.2.4 | Deps install + build stages | Matches project's locked `packageManager: "bun@1.2.4"`. Slim variant is Debian-based (glibc), avoids Alpine musl issues with native deps like `sharp` and `ssh2`. Do NOT upgrade to 1.3.x -- the lockfile was generated with 1.2.4 and `--frozen-lockfile` will reject version mismatches. |
| `node:22-slim` | 22 LTS | Production runner stage | Next.js standalone output runs on Node.js, not Bun. Node 22 is active LTS (supported through April 2027). Slim variant (Debian bookworm) includes glibc needed by `sharp` native bindings without Alpine hassles. |
| `postgres:17-alpine` | 17.x | Local dev database | PostgreSQL 17 is current stable (released Sep 2025). Alpine variant is fine for Postgres (no native Node deps concern). Neon production runs Postgres 17, so local dev should match. |
| `redis:7-alpine` | 7.x | Local dev cache (self-hosted compose only) | Matches the `ioredis` driver already in the codebase. Alpine is fine for Redis (pure C, no glibc deps). |

**Confidence:** HIGH -- versions verified against Docker Hub, project lockfile, and Neon docs.

### Docker Configuration

| Component | File | Purpose | Why |
|-----------|------|---------|-----|
| Multi-stage Dockerfile | `Dockerfile` | 3-stage build (deps, build, runner) | Already exists and is well-structured. Needs minor fixes (see below). |
| `.dockerignore` | `.dockerignore` | Exclude non-build files | Already exists. Needs `.auto-claude/worktrees` added to prevent copying 10 worktrees into build context. |
| `docker-compose.yml` | `docker-compose.yml` | Local dev (app + postgres) | Already exists. Needs schema migration step added. |
| `docker-compose.self-hosted.yml` | `docker-compose.self-hosted.yml` | Self-hosted prod (app + postgres + redis) | Already exists with good structure. |

**Confidence:** HIGH -- reviewed existing files directly.

### Neon Postgres (Production)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@neondatabase/serverless` | ^0.10 (keep current) | HTTP driver for Vercel serverless | Already installed. Uses HTTP transport for one-shot queries, which is fastest for serverless. The existing `db-adapter.ts` auto-detects Neon vs local Postgres via URL -- this pattern is correct. |
| `postgres` | ^3.4 | TCP driver for local dev + migrations | Already installed. Used by `db-adapter.ts` when `DATABASE_DRIVER=postgres` or URL lacks `neon.tech`. Correct for Docker Compose local dev. |
| Neon connection pooling | Built-in PgBouncer | Connection management in production | Neon's pooler runs transaction-mode PgBouncer. Use the `-pooler` hostname variant for app connections, direct hostname for `drizzle-kit push/migrate`. |

**Confidence:** HIGH -- verified against Neon official docs and existing codebase.

### Neon Connection String Configuration

| Context | String Type | Format | Why |
|---------|-------------|--------|-----|
| App runtime (Vercel) | Pooled | `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require` | Serverless functions create many short-lived connections. Pooler handles up to 10,000 concurrent client connections. |
| Migrations (`drizzle-kit push`) | Direct (unpooled) | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | Schema migration tools use `SET` statements and `PREPARE`/`DEALLOCATE`, which are incompatible with transaction-mode PgBouncer. |
| Local Docker Compose | Standard TCP | `postgresql://sessionforge:sessionforge@postgres:5432/sessionforge` | Direct connection to local Postgres container. No pooler needed. |

**Environment variables for Vercel:**
- `DATABASE_URL` -- pooled connection (set automatically by Neon-Vercel integration)
- `DATABASE_URL_UNPOOLED` -- direct connection (set automatically by Neon-Vercel integration)
- Use `DATABASE_URL_UNPOOLED` in build command for migrations

**Confidence:** HIGH -- verified against Neon connection pooling docs (neon.com/docs/connect/connection-pooling).

### Neon-Vercel Integration

| Feature | Configuration | Why |
|---------|---------------|-----|
| Neon Managed Integration | Install from Vercel Marketplace | Creates isolated DB branches per preview deployment automatically. Each PR gets its own Neon branch named `preview/<git-branch>` with copy-on-write data from parent. |
| Preview branch env vars | Auto-injected by integration | `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are set per-deployment, so preview environments never share a database. |
| Build-time migrations | Add to Vercel Build Command | Set Build Command to `cd packages/db && bunx drizzle-kit push && cd ../.. && bun run build` so schema changes propagate to each preview branch. |
| Branch cleanup | Enable in integration settings | Automatically deletes Neon branches when PR is merged/closed. |

**Confidence:** HIGH -- verified against Neon integration docs (neon.com/docs/guides/neon-managed-vercel-integration).

### Vercel Deployment Configuration

| Setting | Value | Why |
|---------|-------|-----|
| Framework Preset | Next.js | Auto-detected. Vercel handles `next build` natively with optimized serverless function packaging. |
| Root Directory | `apps/dashboard` | Points Vercel to the Next.js app within the monorepo. Vercel auto-detects Bun via `bun.lock` at repo root. |
| Install Command | Leave default (auto-detected) | Vercel detects `bun.lock` at repo root and runs `bun install` automatically. The `packageManager` field in root `package.json` (`bun@1.2.4`) reinforces this. |
| Build Command | Override: `cd packages/db && bunx drizzle-kit push --url=$DATABASE_URL_UNPOOLED && cd ../.. && turbo build --filter=@sessionforge/dashboard` | Runs migrations against unpooled connection first, then builds only the dashboard app. |
| Output Directory | Leave default (`.next`) | Vercel auto-detects Next.js output location. |
| Node.js Version | 22.x | Set in Project Settings. Matches the `node:22-slim` Docker runner image. |
| Skip unaffected projects | Enable | Prevents builds when only unrelated packages change. Requires unique `name` fields in each package.json (already present). |

**Confidence:** MEDIUM -- Vercel auto-detection for Bun monorepos is well-documented but specific build command with migration needs testing in practice.

### Vercel Environment Variables

| Variable | Scope | Source |
|----------|-------|--------|
| `DATABASE_URL` | Auto (all envs) | Neon integration injects pooled connection |
| `DATABASE_URL_UNPOOLED` | Auto (all envs) | Neon integration injects direct connection |
| `BETTER_AUTH_SECRET` | Manual (all envs) | Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Manual (production) | Set to production URL |
| `NEXT_PUBLIC_APP_URL` | Manual (production + preview) | Production URL; preview uses `VERCEL_URL` |
| `STRIPE_SECRET_KEY` | Manual (production) | From Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Manual (production) | From Stripe webhook config |
| `UPSTASH_REDIS_URL` | Manual (production) | From Upstash dashboard |
| `UPSTASH_REDIS_TOKEN` | Manual (production) | From Upstash dashboard |
| `UPSTASH_QSTASH_TOKEN` | Manual (production) | From Upstash dashboard |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | Manual (production) | From Upstash dashboard |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | Manual (production) | From Upstash dashboard |
| `GITHUB_CLIENT_ID` | Manual (production) | GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | Manual (production) | GitHub OAuth app |
| `CRON_SECRET` | Manual (production) | Generate with `openssl rand -hex 32` |
| `DISABLE_AI_AGENTS` | Manual (all envs) | `true` unless Claude CLI available |

### GitHub Actions CI Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `oven-sh/setup-bun@v2` | v2 (latest) | Install Bun in CI | Has built-in executable caching. Reads version from `packageManager` field in `package.json` automatically, ensuring CI uses exact same Bun 1.2.4. |
| `actions/cache@v4` | v4 | Cache Bun dependency installs | Cache `~/.bun/install/cache` keyed on `bun.lock` hash. setup-bun v2 caches the Bun binary itself, but deps still need explicit caching. |
| `actions/checkout@v4` | v4 | Checkout code | Standard. |
| `actions/upload-artifact@v4` | v4 | Upload build/test artifacts | For Playwright reports, coverage reports. |

**Confidence:** HIGH -- verified against setup-bun GitHub repo and existing CI workflows.

### CI Workflow Structure

| Job | Steps | Dependencies | Why |
|-----|-------|-------------|-----|
| `ci` (lint + typecheck + build) | checkout, setup-bun, cache deps, install, tsc --noEmit, lint, build | None | Catches compilation errors and lint issues. Already exists in `.github/workflows/ci.yml`. |
| `schema-drift` | checkout, setup-bun, cache deps, install, drizzle-kit generate --check | None | Catches schema/migration drift. Already exists. No DB required (offline check). |
| `docker` | checkout, docker build | None | Verifies Docker image builds successfully. Already exists. |
| `container-smoke` (NEW) | checkout, docker compose up, healthcheck, docker compose down | `docker` | Verifies the containerized app actually starts and responds. Missing from current CI. |

**Confidence:** HIGH for existing jobs. MEDIUM for container-smoke (standard pattern but needs to be implemented).

### CI Workflow Fixes Needed

The existing workflows have inconsistencies that should be resolved:

| Issue | File | Fix |
|-------|------|-----|
| setup-bun version mismatch | `test.yml` | Uses `@v2` with `bun-version: latest` instead of pinned 1.2.4. Change to omit `bun-version` so it reads from `packageManager` field. |
| Missing Bun cache | `test.yml` | No `actions/cache` for `~/.bun/install/cache`. Add it. |
| Duplicate lint job | `test.yml` vs `ci.yml` | Both run lint. Remove from `test.yml` -- `ci.yml` already covers it. |
| Missing `DATABASE_URL` + `BETTER_AUTH_SECRET` | `test.yml` | Missing env vars that `ci.yml` provides. Tests may fail on import resolution. |
| E2E missing database | `test.yml` e2e job | No Postgres service container. E2E tests against the built app need a database. |
| Nightly E2E no database | `e2e.yml` | References `secrets.DATABASE_URL` but no Postgres service. If secrets aren't set, tests fail silently. |

**Confidence:** HIGH -- verified by reading all three workflow files directly.

## Dockerfile Improvements Needed

The existing Dockerfile is solid but needs these adjustments:

### Current Issues

1. **Runner image is `node:20-slim`** -- should be `node:22-slim` for active LTS support (Node 20 enters maintenance LTS Oct 2024, EOL Apr 2026).

2. **Missing `sharp` in runner stage** -- `sharp` has native bindings that are not included in Next.js standalone trace. Must install `sharp` in the runner stage or set `NEXT_SHARP_PATH`.

3. **No `.auto-claude` exclusion in `.dockerignore`** -- the 10 worktree directories add gigabytes to the Docker build context.

4. **No migration step** -- Docker Compose should run `drizzle-kit push` against local Postgres before app starts, or the database will have no tables.

### Recommended Dockerfile Changes

```dockerfile
# Stage 3: Production runner
FROM node:22-slim AS runner      # <-- upgrade from node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install sharp for image optimization
RUN npm install --cpu=x64 --os=linux --libc=glibc sharp@0.34  # <-- NEW

# Copy standalone output
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/healthcheck').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/dashboard/server.js"]
```

### .dockerignore Additions

```
.auto-claude
.auto-claude/**
```

**Confidence:** HIGH for node:22 upgrade, sharp install, and dockerignore. These are well-documented patterns.

## Docker Compose Local Dev Improvements

### Schema Migration Entrypoint

The current `docker-compose.yml` starts the app but never creates database tables. Add an init container or entrypoint script:

**Option A (recommended): Init service in docker-compose.yml**
```yaml
services:
  db-migrate:
    build: .
    entrypoint: ["sh", "-c", "cd packages/db && bunx drizzle-kit push"]
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: "postgresql://sessionforge:sessionforge@postgres:5432/sessionforge"
    profiles: ["init"]
```

Run once with: `docker compose --profile init run db-migrate`

**Option B: Override app entrypoint**

Add a `docker-entrypoint.sh` that runs migrations before starting the app server. Simpler but couples migration to every container start.

**Confidence:** MEDIUM -- both patterns work but need testing with the specific drizzle-kit + bun + monorepo layout in Docker context.

### Dev Hot-Reload Compose (Not Docker Build)

For actual development, developers should use `bun install && bun run dev` locally (not Docker). The Docker Compose dev environment is for:
1. Providing local Postgres without requiring a Neon account
2. Smoke-testing the production Docker image locally
3. CI container verification

A dev-only compose file for just the database:

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: sessionforge
      POSTGRES_PASSWORD: sessionforge
      POSTGRES_DB: sessionforge
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sessionforge"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

Usage: `docker compose -f docker-compose.dev.yml up -d` then `DATABASE_URL=postgresql://sessionforge:sessionforge@localhost:5432/sessionforge DATABASE_DRIVER=postgres bun run dev`

**Confidence:** HIGH -- standard pattern for Next.js monorepo local dev.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Runner image | `node:22-slim` | `node:22-alpine` | Alpine is "experimental and not officially supported" for Node.js per Node.js docs. `sharp` native bindings require extra glibc compat layers on Alpine. Slim is ~40MB larger but zero compatibility issues. |
| Runner image | `node:22-slim` | `oven/bun:1.2.4-slim` for runner | Next.js standalone output uses `server.js` designed for Node.js runtime. Bun can run it but has known issues with Next.js App Router SSR (drizzle-orm relation resolution bugs documented in project CLAUDE.md). |
| Build image | `oven/bun:1.2.4-slim` | `node:22-slim` + install bun | Adds complexity. The official oven/bun image is purpose-built for `bun install`. |
| Local Postgres | `postgres:17-alpine` | `postgres:16-alpine` | Neon runs Postgres 17. Local dev should match production version for feature parity (e.g., incremental JSON functions in PG17). The existing compose uses 16 -- upgrade to 17. |
| CI runner | `ubuntu-latest` | Custom Docker image | Unnecessary complexity for a standard Bun/Node.js project. setup-bun action handles installation cleanly. |
| Neon branching | Neon Managed Integration | Manual branch creation via API | Integration handles webhook-driven branch creation, env var injection, and cleanup automatically. Manual approach requires maintaining custom GitHub Actions. |
| Docker Compose migration | Init service with profile | App entrypoint script | Entrypoint runs migration on every container start. Init service runs once explicitly, which is safer and faster for subsequent starts. |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| `node:22-alpine` for runner | `sharp` native deps break. Would need `npm install --cpu=x64 --os=linux --libc=musl sharp` and even then, Alpine Node.js is officially "experimental." |
| `oven/bun:alpine` variants | Documented glibc issues (GitHub issue #1567: "glibc Alpine is broken and shall not be used"). Even with recent Alpine 3.22 improvements, not worth the risk for a production build. |
| `docker-compose` (v1 standalone) | Deprecated. Use `docker compose` (v2, plugin-based). Already correct in project -- just noting for documentation. |
| Vercel-Managed Neon Integration | Only use if you want consolidated Vercel billing for Neon. The Neon-Managed Integration gives more control over database configuration and is recommended when you already have a Neon account. |
| `drizzle-kit migrate` for local dev | `drizzle-kit push` is simpler for dev (applies schema directly without generating SQL migration files). Use `migrate` for production if you need auditable migration history, but `push` is what the project currently uses. |
| Turbopack for Docker builds | Project constraint: "Use `next dev` (NOT --turbopack) -- Turbopack has drizzle-orm relation bugs in bun monorepos." This applies to dev only; `next build` does not use Turbopack regardless. |

## Vercel Cron Jobs

The project already has a cron job defined. For Vercel deployment, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/automation",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

The route must verify the `CRON_SECRET` bearer token. The existing route at `apps/dashboard/src/app/api/cron/automation/route.ts` should already handle this based on the `CRON_SECRET` env var listed in the codebase stack doc.

**Note:** `*/5 * * * *` (every 5 minutes) requires Vercel Pro plan. Hobby plan minimum is once per day.

**Confidence:** HIGH -- matches existing project configuration.

## Installation

No new packages needed. The existing dependencies cover all containerization and deployment needs:

```bash
# Already installed:
# @neondatabase/serverless (Neon HTTP driver for Vercel)
# postgres (TCP driver for local dev)
# drizzle-orm + drizzle-kit (schema management)
# ioredis (local Redis in Docker Compose)
# @upstash/redis (production Redis on Vercel)

# Only infrastructure tooling needed (not npm packages):
# Docker Desktop (local)
# Vercel CLI (optional, for manual deploys): npm i -g vercel
```

## Sources

### Official Documentation (HIGH confidence)
- [Neon Connection Pooling](https://neon.com/docs/connect/connection-pooling) -- pooled vs direct connection strings, PgBouncer config
- [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver) -- HTTP and WebSocket transport options
- [Neon-Vercel Integration](https://neon.com/docs/guides/neon-managed-vercel-integration) -- preview branch setup, env var injection
- [Neon + Drizzle Guide](https://neon.com/docs/guides/drizzle) -- driver configuration for Drizzle ORM
- [Neon Local + Vercel Guide](https://neon.com/guides/drizzle-local-vercel) -- dual-driver pattern for local/production
- [Vercel Monorepos](https://vercel.com/docs/monorepos) -- root directory, skip unaffected projects, Bun workspace support
- [Vercel Build Configuration](https://vercel.com/docs/builds/configure-a-build) -- install/build/output settings
- [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) -- GitHub Action config, caching, version detection
- [Bun Docker Guide](https://bun.com/docs/guides/ecosystem/docker) -- official Docker patterns
- [Drizzle Kit Push](https://orm.drizzle.team/docs/drizzle-kit-push) -- schema push workflow

### Docker Hub Images
- [oven/bun](https://hub.docker.com/r/oven/bun) -- Bun Docker image tags
- [node](https://hub.docker.com/_/node) -- Node.js official images
- [postgres](https://hub.docker.com/_/postgres) -- PostgreSQL official images

### Community Sources (MEDIUM confidence, verified against official docs)
- [Next.js Standalone Docker Sharp](https://flinect.com/blog/nextjs-standalone-docker-sharp-installation) -- sharp installation in runner stage
- [Bun Alpine glibc Issue #1567](https://github.com/oven-sh/bun/issues/1567) -- Alpine compatibility problems
- [Next.js Docker Discussions](https://github.com/vercel/next.js/discussions/16995) -- community multi-stage build patterns
