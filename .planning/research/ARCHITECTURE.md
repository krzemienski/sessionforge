# Architecture Research

**Domain:** Next.js 15 Monorepo Containerization and Dual Deployment (Docker + Vercel/Neon)
**Researched:** 2026-03-22
**Confidence:** HIGH

## System Overview

```
                         DEPLOYMENT TARGETS
     ┌──────────────────────────┬──────────────────────────┐
     │     LOCAL / SELF-HOST    │        VERCEL PROD       │
     │                          │                          │
     │  ┌────────────────────┐  │  ┌────────────────────┐  │
     │  │  Docker Container  │  │  │  Serverless Fns    │  │
     │  │  (standalone node) │  │  │  (App Router)      │  │
     │  └────────┬───────────┘  │  └────────┬───────────┘  │
     │           │              │            │              │
     │  ┌────────▼───────────┐  │  ┌────────▼───────────┐  │
     │  │  Local Postgres    │  │  │  Neon Postgres     │  │
     │  │  (Docker, pg:16)   │  │  │  (Serverless)      │  │
     │  └────────────────────┘  │  └────────────────────┘  │
     │                          │                          │
     │  ┌────────────────────┐  │  ┌────────────────────┐  │
     │  │  Redis (optional)  │  │  │  Upstash Redis     │  │
     │  │  (Docker, redis:7) │  │  │  (Serverless)      │  │
     │  └────────────────────┘  │  └────────────────────┘  │
     └──────────────────────────┴──────────────────────────┘

                         BUILD PIPELINE
     ┌──────────────────────────────────────────────────────┐
     │                                                      │
     │  ┌──────────┐    ┌──────────┐    ┌──────────────┐    │
     │  │ packages │    │ turbo    │    │ next build   │    │
     │  │  /db     │───>│ build    │───>│ (standalone) │    │
     │  │  /tsconf │    │          │    │              │    │
     │  └──────────┘    └──────────┘    └──────┬───────┘    │
     │                                         │            │
     │                    ┌────────────────────┐│            │
     │                    │                    ││            │
     │              ┌─────▼──────┐    ┌────────▼─────┐      │
     │              │  Docker    │    │  Vercel      │      │
     │              │  Image     │    │  Deploy      │      │
     │              └────────────┘    └──────────────┘      │
     └──────────────────────────────────────────────────────┘
```

## Component Boundaries

### Container Architecture: Single Container

**Recommendation:** Single container for the Next.js app + sidecar containers for infrastructure (Postgres, Redis).

**Rationale:** SessionForge has one deployable application (`apps/dashboard`). The `packages/db` and `packages/tsconfig` are build-time dependencies consumed at compile, not runtime services. A multi-container split (e.g., separate API container vs SSR container) adds orchestration complexity with zero benefit at alpha scale.

| Component | Container | Purpose | Communicates With |
|-----------|-----------|---------|-------------------|
| `apps/dashboard` (standalone) | `app` | Next.js server: SSR, API routes, agent execution | postgres, redis |
| PostgreSQL 16 | `postgres` | Relational data (30 tables, Drizzle schema) | app |
| Redis 7 | `redis` | Cache, rate limiting, session store (optional) | app |

**What goes in the `app` container:**
- `.next/standalone/` output (server.js + minimal node_modules)
- `.next/static/` (client JS/CSS bundles)
- `public/` (static assets)
- Non-root user (`nextjs:nodejs`, UID 1001)

**What stays outside:**
- Source code, dev dependencies, turbo cache, worktree dirs
- `.auto-claude/`, `.omc/`, `.claude/`, `plans/`, `e2e-evidence/`
- All `.env` files (injected at runtime)

### Vercel Architecture: Serverless

On Vercel, the same Next.js app deploys as:

| Component | Vercel Primitive | Notes |
|-----------|-----------------|-------|
| Pages/layouts | Serverless Functions | Auto-split by route |
| API routes | Serverless Functions | 300s maxDuration for AI agents |
| Static assets | Edge Network (CDN) | `.next/static/`, `public/` |
| Cron automation | Vercel Cron | `*/5 * * * *` on `/api/cron/automation` |
| Database | Neon Postgres | Serverless driver over HTTP |
| Cache | Upstash Redis | REST API over HTTP |

## Data Flow: Local Postgres Mirroring Neon

### The Dual-Driver Pattern (Already Implemented)

The codebase already has `db-adapter.ts` with a clean dual-driver pattern:

```
┌─────────────────────────────────────────────────────┐
│                     db-adapter.ts                    │
│                                                      │
│  DATABASE_DRIVER env?                                │
│      │                                               │
│      ├── "neon" ──────> @neondatabase/serverless     │
│      │                  (neon-http driver)            │
│      │                                               │
│      ├── "postgres" ──> postgres (postgres-js)       │
│      │                  (standard TCP driver)         │
│      │                                               │
│      └── unset ────────> auto-detect from URL        │
│                          (neon.tech = neon, else pg)  │
│                                                      │
│  Both export: db (NeonHttpDatabase<schema>)           │
└─────────────────────────────────────────────────────┘
```

**This is the correct pattern.** The `docker-compose.yml` already sets `DATABASE_DRIVER=postgres` (via the self-hosted variant) and `DATABASE_URL` pointing to the local container. No code changes needed for the data layer.

### Schema Synchronization Strategy

```
┌──────────────┐         ┌──────────────┐
│ packages/db  │         │ packages/db  │
│ schema.ts    │────────>│ drizzle.     │
│ (source of   │         │ config.ts    │
│  truth)      │         │              │
└──────┬───────┘         └──────┬───────┘
       │                        │
       │ drizzle-kit push       │ drizzle-kit push
       │                        │
       ▼                        ▼
┌──────────────┐         ┌──────────────┐
│ Local PG     │         │ Neon PG      │
│ (Docker)     │         │ (Production) │
└──────────────┘         └──────────────┘
```

**Use `drizzle-kit push` for both targets.** The same `schema.ts` drives both local Docker Postgres and Neon production. The `drizzle.config.ts` reads `DATABASE_URL` from the environment, so running it with different env files targets different databases.

**Do NOT use SQL init scripts for schema.** Init scripts in `/docker-entrypoint-initdb.d/` create schema drift risk. Instead:

1. `docker compose up -d postgres` -- start Postgres container
2. `DATABASE_URL=postgresql://sessionforge:sessionforge@localhost:5432/sessionforge bunx drizzle-kit push` -- apply schema
3. `docker compose up -d app` -- start app

This can be wrapped in a `scripts/setup-local.sh` one-liner.

### Volume Management

```yaml
volumes:
  pgdata:      # Persistent Postgres data across container restarts
  redisdata:   # Persistent Redis data (optional, AOF enabled)
```

**Keep pgdata as a named volume**, not a bind mount. This avoids permission issues on macOS/Linux and allows `docker compose down -v` for clean reset.

**Add a seed script (optional):** For development convenience, a `scripts/seed.ts` can insert demo data after schema push. But the schema itself must come from `drizzle-kit push`, never from raw SQL.

## Neon Branching Architecture

### Recommended Branch Layout

```
┌─────────────────────────────────────────┐
│              Neon Project               │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  main (production)              │    │
│  │  - Protected branch             │    │
│  │  - Scale-to-zero: DISABLED      │    │
│  │  - Autoscaling: 1-4 CU          │    │
│  │  - Connection pooling: ON       │    │
│  │  - 7-day restore window         │    │
│  └──────────┬──────────────────────┘    │
│             │ branch from               │
│  ┌──────────▼──────────────────────┐    │
│  │  dev (development/staging)      │    │
│  │  - Scale-to-zero: ENABLED       │    │
│  │  - Autoscaling: 0.25-1 CU       │    │
│  │  - Own credentials              │    │
│  │  - Drizzle push target          │    │
│  └──────────┬──────────────────────┘    │
│             │ branch from (per PR)      │
│  ┌──────────▼──────────────────────┐    │
│  │  preview/pr-<N>-<branch>        │    │
│  │  - Ephemeral (auto-expire)       │    │
│  │  - Created by GitHub Actions     │    │
│  │  - Used by Vercel preview deploys│    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Connection Pooling Strategy

| Environment | Driver | Connection Approach |
|-------------|--------|---------------------|
| Vercel Prod | `@neondatabase/serverless` (neon-http) | Stateless HTTP queries, no pool needed |
| Vercel Preview | `@neondatabase/serverless` (neon-http) | Same, against branch endpoint |
| Docker local | `postgres` (postgres-js) | Direct TCP to local PG, no pool needed |
| Docker self-hosted | `postgres` (postgres-js) | Direct TCP to sidecar PG |

The Neon serverless driver (`neon-http`) is inherently pooling-friendly because it does HTTP-based queries -- each request is stateless. No PgBouncer configuration needed for the serverless path.

For Docker/self-hosted, the standard `postgres` driver creates persistent connections. At alpha scale, this is fine without additional pooling. If needed later, add PgBouncer as a sidecar container.

## Git Worktree Convergence Architecture

### Current State

10 active worktrees exist for specs 031-041, each on separate branches under `auto-claude/` prefix.

### Recommended Merge Order

```
Phase 1: Low-risk, no schema changes
  037-wcag-accessibility-compliance        (UI-only, CSS/ARIA)
  041-mobile-responsive-dashboard-experience (UI-only, responsive)
  036-series-collection-advanced-filtering  (routing/filter, existing schema)

Phase 2: Schema-touching, moderate risk
  035-content-versioning-visual-diff-view  (postRevisions changes)
  031-a-b-headline-and-hook-experimentation (new tables likely)
  034-voice-calibration-authentic-content-engine (style profile schema)

Phase 3: Cross-cutting, highest conflict risk
  039-structured-data-rich-snippet-optimization (SEO/meta, touches many pages)
  040-ai-content-repurposing-engine         (new agent, touches agent-runner)
  032-compliance-billing-trust-center       (billing changes, trust center)

Skip/Defer:
  038-comprehensive-test-coverage-expansion  (test framework, conflicts
                                              with project's no-mock mandate)
```

### Merge Protocol

```
For each worktree branch (in order above):

1. git fetch origin
2. git checkout auto-claude/<spec>
3. git rebase main          ← rebase onto current main
4. Resolve conflicts if any
5. git checkout main
6. git merge auto-claude/<spec> --no-ff   ← preserve branch history
7. Build: bun run build     ← must pass
8. Validate: start app, check affected features
9. If broken → revert merge, fix on branch, retry
10. Tag: git tag post-merge-<spec>
```

**Key principle:** One merge at a time. Build and validate after each. Never batch-merge.

### Conflict Hotspots

| File/Area | Likely Conflicting Branches | Resolution |
|-----------|---------------------------|------------|
| `schema.ts` | 031, 034, 035 | Merge schema additions are usually additive; check enum conflicts |
| `sidebar nav` | 037, 041 | Take 041 (mobile-responsive) as base, layer 037 (a11y) on top |
| `content page` | 036, 039 | 036 filtering first, then 039 SEO additions |
| `agent-runner.ts` | 034, 040 | 034 (voice) first since it adds to existing, then 040 (new agent) |
| `billing/` | 032 | Merge last, it is the most isolated cross-cutting change |

## CI/CD Pipeline Architecture

### GitHub Actions Workflow Structure

```
┌─────────────────────────────────────────────────────────┐
│                   .github/workflows/                     │
│                                                          │
│  ci.yml (on: push to main, PR to main)                   │
│  ├── Job: lint          (bun install → turbo lint)       │
│  ├── Job: typecheck     (bun install → turbo build)      │
│  ├── Job: docker-build  (buildx, cache GHA, verify run)  │
│  └── Job: schema-drift  (drizzle-kit check against Neon) │
│                                                          │
│  deploy.yml (on: push to main, after ci passes)          │
│  └── Job: vercel-deploy (vercel deploy --prod)           │
│                                                          │
│  e2e.yml (existing, nightly + manual dispatch)           │
│  └── Job: playwright against Vercel preview              │
│                                                          │
│  preview.yml (on: PR opened/sync)                        │
│  ├── Job: neon-branch   (create Neon branch for PR)      │
│  └── Job: vercel-preview (deploy preview with branch DB) │
└─────────────────────────────────────────────────────────┘
```

### Recommended `ci.yml` Workflow

```yaml
# Conceptual structure (not final implementation)
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: "1.2.4" }
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ hashFiles('bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun run lint

  typecheck-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: "1.2.4" }
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ hashFiles('bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun run build   # turbo build (typecheck via tsc in packages/db)
        env:
          NEXT_TELEMETRY_DISABLED: "1"

  docker-build:
    runs-on: ubuntu-latest
    needs: [typecheck-and-build]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          load: true
          tags: sessionforge:ci
          cache-from: type=gha
          cache-to: type=gha,mode=max
      # Smoke test: start container, hit healthcheck
      - run: |
          docker compose -f docker-compose.yml up -d
          sleep 10
          curl -f http://localhost:3000/api/healthcheck || exit 1
          docker compose down
```

### Caching Strategy

| What | Cache Method | Key |
|------|-------------|-----|
| Bun packages | `actions/cache` on `~/.bun/install/cache` | `bun-${{ hashFiles('bun.lock') }}` |
| Turbo build | Turborepo Remote Cache (Vercel) | Automatic with `TURBO_TOKEN` |
| Docker layers | GitHub Actions cache (`type=gha`) | BuildKit automatic |
| Playwright | `actions/cache` on `~/.cache/ms-playwright` | `playwright-${{ hashFiles('apps/dashboard/package.json') }}` |

## Build Order (Suggested Phase Sequence)

Based on dependency analysis:

```
1. CONVERGE WORKTREES    ← Must happen first: stabilize codebase
   └── Merge 10 branches into main sequentially
   └── Fix merge conflicts, validate after each

2. CONTAINERIZE          ← Requires stable codebase
   └── Refine existing Dockerfile (already 90% correct)
   └── Add init script for local schema push
   └── Verify docker compose up works end-to-end

3. NEON BRANCHING        ← Can parallel with containerization
   └── Set up production branch config
   └── Set up dev branch
   └── Configure preview branch automation

4. CI PIPELINE           ← Requires stable Dockerfile + Neon
   └── Add ci.yml with lint, build, docker-build jobs
   └── Add preview.yml with Neon branch + Vercel preview
   └── Remove/update existing test.yml and e2e.yml

5. VERCEL DEPLOYMENT     ← Requires CI pipeline working
   └── Verify vercel.json config (already present)
   └── Set env vars in Vercel dashboard
   └── Deploy and validate

6. VALIDATION            ← Final gate
   └── 50+ features validated in both Docker and Vercel
   └── Tag v0.1.0-alpha
```

**Why this order:**
- Convergence must be first because containerizing or deploying divergent code is wasted work
- Containerization and Neon branching are independent and can overlap
- CI pipeline needs both Docker and Neon to be ready
- Vercel deployment is the final production gate
- Validation runs against both targets to prove parity

## Architectural Patterns

### Pattern 1: Environment-Driven Driver Selection

**What:** The `db-adapter.ts` pattern of auto-detecting the correct database driver based on environment variables and URL shape.

**When to use:** Any service that must run against both local Docker Postgres and Neon serverless.

**Trade-offs:** Slight type unsafety (the `as unknown as NeonHttpDatabase` cast) in exchange for zero-config switching. Acceptable because the Drizzle query API is identical for both drivers.

### Pattern 2: Multi-Stage Docker Build with Standalone Output

**What:** Three-stage Dockerfile: deps (bun install) -> builder (next build) -> runner (node:20-slim with standalone output only).

**When to use:** Any Next.js app targeting Docker deployment. The standalone output strips unused node_modules, producing images around 150-200MB instead of 1GB+.

**Trade-offs:** Requires `output: "standalone"` in next.config, which is already configured. Sharp (image processing) needs special handling -- the existing Dockerfile handles this by using `node:20-slim` as the runner base (not Alpine, which lacks Sharp's native deps).

### Pattern 3: Compose Overlay Files

**What:** Multiple docker-compose files for different environments: `docker-compose.yml` (local dev), `docker-compose.prod.yml` (production env pass-through), `docker-compose.self-hosted.yml` (full stack with Redis).

**When to use:** When the same app needs different infrastructure configurations. Use `docker compose -f docker-compose.yml -f docker-compose.prod.yml up` to overlay.

**Trade-offs:** More files to maintain, but clear separation of concerns. The existing three-file setup is appropriate.

## Anti-Patterns

### Anti-Pattern 1: SQL Init Scripts for Schema

**What people do:** Put `CREATE TABLE` statements in `/docker-entrypoint-initdb.d/init.sql`

**Why it is wrong:** Creates two sources of truth for schema (the SQL file and Drizzle `schema.ts`). They inevitably drift. Init scripts also only run on empty databases, so schema changes require `docker compose down -v` every time.

**Do this instead:** Use `drizzle-kit push` after Postgres starts. This is idempotent, uses the real schema definition, and handles incremental changes.

### Anti-Pattern 2: Separate Dockerfiles for Dev and Prod

**What people do:** Create `Dockerfile.dev` with hot-reload and `Dockerfile.prod` with standalone output.

**Why it is wrong:** Docker is not the right tool for Next.js development. Hot-reload in Docker on macOS is painfully slow due to filesystem bridging. The project explicitly recommends `next dev` (not even Turbopack).

**Do this instead:** Use `bun run dev` locally for development. Docker is for production builds and CI verification only.

### Anti-Pattern 3: Hardcoding Neon Connection Strings in Docker Compose

**What people do:** Put the Neon production URL directly in docker-compose.yml.

**Why it is wrong:** Leaks production credentials into version control. Also defeats the purpose of local development (you want a local database, not to hit production).

**Do this instead:** The existing `docker-compose.yml` correctly uses local Postgres. Production Neon URLs go in `.env` files (gitignored) or Vercel environment variables.

### Anti-Pattern 4: Running `drizzle-kit push` Against Production in CI

**What people do:** Automate schema migrations by running `drizzle-kit push` against the production Neon database in CI.

**Why it is wrong:** `drizzle-kit push` can make destructive changes (drop columns, rename tables) without confirmation in non-interactive mode. For production databases, this risks data loss.

**Do this instead:** Use `drizzle-kit push` for local dev. For production, use `drizzle-kit generate` to create migration files, review them, then apply via `drizzle-kit migrate`. Add a `schema-drift` CI job that runs `drizzle-kit check` to detect when schema.ts diverges from production.

## Integration Points

### External Services

| Service | Integration Pattern | Container vs Serverless Notes |
|---------|---------------------|-------------------------------|
| Neon Postgres | `@neondatabase/serverless` (prod), `postgres` (local) | `db-adapter.ts` handles switching |
| Upstash Redis | `@upstash/redis` REST API (prod), `ioredis` TCP (local) | Needs similar adapter pattern |
| Upstash QStash | `@upstash/qstash` HTTP (prod) | Disabled in Docker by default |
| Stripe | `stripe` SDK via API routes | Same in both; uses env var for API key |
| Claude Agent SDK | `@anthropic-ai/claude-agent-sdk` | `DISABLE_AI_AGENTS=true` in Docker |
| Hashnode/WordPress/Dev.to | HTTP publishing APIs | Same in both; uses env vars for tokens |
| GitHub OAuth | Better Auth OAuth flow | Requires `BETTER_AUTH_URL` matching the deployment URL |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `packages/db` -> `apps/dashboard` | TypeScript import (workspace alias) | Build-time only; `@sessionforge/db` |
| App container -> Postgres container | TCP on port 5432 | Docker internal network; no port exposure needed for app->pg |
| App container -> Redis container | TCP on port 6379 | Same Docker network |
| Vercel Functions -> Neon | HTTP(S) via serverless driver | Stateless, no pooling needed |
| Browser -> App | HTTPS (prod) / HTTP (local:3000) | SSR + API routes on same origin |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (alpha) | Single container + sidecar Postgres. Neon Free/Launch tier. Current setup is sufficient. |
| 100-1K users | Enable Neon connection pooling. Add Upstash Redis for real caching (currently placeholder). Consider read replica for analytics queries. |
| 1K-10K users | Split long-running AI agent routes to background workers (QStash + webhook callback pattern). Neon autoscaling to 4 CU. Multi-region Vercel deployment. |
| 10K+ users | Not a concern for alpha. Would need dedicated compute, queue workers, CDN for media. |

### First Bottleneck: AI Agent Execution Time

Agent routes have 300s maxDuration on Vercel. In Docker, there is no timeout. The `runAgentStreaming()` pattern with SSE is correct for both, but heavy concurrent agent usage will exhaust serverless function slots on Vercel's free/hobby tier. Mitigation: the existing `checkQuota()` and `DISABLE_AI_AGENTS` flag.

### Second Bottleneck: Cold Starts

Neon databases scale to zero on non-production branches. First query after idle can take 500ms-2s. Mitigation: keep production branch scale-to-zero disabled (1-4 CU autoscaling). For Docker, not applicable (Postgres is always running).

## Sources

- [Next.js Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying) - Official deployment guide covering Docker standalone output (HIGH confidence)
- [Vercel Monorepo Docs](https://vercel.com/docs/monorepos) - Monorepo detection, build skipping, workspace requirements (HIGH confidence)
- [Neon Branching Docs](https://neon.com/docs/introduction/branching) - Branch creation, isolation, restore windows (HIGH confidence)
- [Neon Production Best Practices](https://neon.com/blog/6-best-practices-for-running-neon-in-production) - CU config, scale-to-zero, IP allowlist (HIGH confidence)
- [Neon Workflow Primer](https://neon.com/docs/get-started/workflow-primer) - Dev/preview branch naming, ephemeral branches (HIGH confidence)
- [Drizzle + Local/Neon Guide](https://neon.com/guides/drizzle-local-vercel) - Dual-driver pattern, Docker compose with Neon proxy (HIGH confidence)
- [Neon Connection Pooling](https://neon.com/docs/connect/connection-pooling) - PgBouncer transaction mode, pooled connection strings (HIGH confidence)
- [Docker Build Cache in GitHub Actions](https://docs.docker.com/build/ci/github-actions/cache/) - BuildKit GHA cache backend (HIGH confidence)
- [Vercel Deploying Turborepo](https://vercel.com/docs/monorepos/turborepo) - Remote cache, build detection (HIGH confidence)

---
*Architecture research for: SessionForge v0.1.0-alpha Containerization and Deployment*
*Researched: 2026-03-22*
