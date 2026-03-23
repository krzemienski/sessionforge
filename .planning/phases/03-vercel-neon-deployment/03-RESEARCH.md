# Phase 3: Vercel + Neon Deployment - Research

**Researched:** 2026-03-23
**Domain:** Vercel deployment, Neon Postgres, drizzle-kit migrations, Next.js monorepo
**Confidence:** HIGH

## Summary

Phase 3 is primarily a configuration and deployment phase, not a code-writing phase. The codebase is already well-prepared from Phase 2 (Docker hardening): `next.config.ts` has `output: "standalone"`, `db-adapter.ts` auto-detects Neon URLs, healthcheck and deployment/validate endpoints exist and function correctly, and `vercel.json` already exists with function timeouts, cron configuration, and region settings.

The critical work is: (1) update `vercel.json` build command to prepend `drizzle-kit push --force` against the unpooled Neon URL before the turbo build, (2) link the project to Vercel via CLI or dashboard, (3) provision Neon Postgres and configure env vars, and (4) verify endpoints respond on production. The `--force` flag on drizzle-kit push is essential -- without it, push hangs on interactive prompts for new enums/columns (documented in CLAUDE.md and Phase 2 research).

**Primary recommendation:** Update vercel.json build command, link project, configure env vars, deploy, and verify -- minimal code changes needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Use Vercel CLI or dashboard to create/link the project -- the app already has `output: "standalone"` in next.config.ts
- D-02: Build command must run `drizzle-kit push` before `turbo build` -- this ensures schema is synced before the app builds (per DEPL-04)
- D-03: Provision Neon Postgres with pooled connection string for runtime and unpooled/direct for migrations -- the db-adapter.ts already supports DATABASE_DRIVER switching
- D-04: Use `@neondatabase/serverless` for runtime (already in deps) and standard postgres connection for migrations
- D-05: All required env vars from .env.example must be configured in Vercel project -- use the comprehensive list from Phase 2's rewritten .env.example
- D-06: `DATABASE_DRIVER` should NOT be set (or set to "neon") for Vercel -- the db-adapter auto-detects Neon URLs
- D-07: `/api/healthcheck` must return 200 on production -- already exists, was fixed in Phase 2 for Redis detection
- D-08: `/api/deployment/validate` must confirm all services connected -- already exists in codebase

### Claude's Discretion
- Exact Vercel project name and domain
- Whether to use Vercel CLI or dashboard for initial setup
- Build timeout and function configuration
- Whether to enable Vercel Analytics/Speed Insights

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPL-01 | User can access SessionForge at a live Vercel production URL | vercel.json already exists with framework/region/function config; project needs linking and deploy |
| DEPL-02 | User can see Neon database provisioned with production branch (scale-to-zero disabled) | Neon Managed Vercel Integration auto-provisions; scale-to-zero configurable in Neon dashboard |
| DEPL-03 | User can see pooled connection string used for runtime, unpooled for migrations | db-adapter.ts auto-detects Neon URLs for runtime; build command uses `--url=$DATABASE_URL_UNPOOLED` for migrations |
| DEPL-04 | User can see build command runs drizzle-kit push before turbo build | vercel.json buildCommand needs updating; `--force` flag required for non-interactive operation |
| DEPL-05 | User can see all required env vars configured in Vercel project | .env.example documents all vars; deployment/validate endpoint checks them at runtime |
| DEPL-06 | User can see /api/healthcheck returns 200 on production | Endpoint exists, tests DB and Redis connectivity, returns structured JSON |
| DEPL-07 | User can see /api/deployment/validate confirms all services connected | Endpoint exists, checks required/optional vars, DB, Redis, detects deployment mode |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No mocks**: NEVER write test files, mocks, or stubs -- build and run the real system
- **Agent SDK auth**: Claude Agent SDK inherits from CLI session -- no ANTHROPIC_API_KEY. On Vercel, `DISABLE_AI_AGENTS=true` since Claude CLI is not available
- **Dev server**: Use `next dev` (NOT --turbopack) -- Turbopack has drizzle-orm relation bugs
- **Container portability**: No provider-specific code inside containers -- all specifics in env vars
- **Schema parity**: Local Docker Postgres must use identical schema to Neon production
- **drizzle-kit push may hang**: On interactive prompts for new enums/columns. Use `--force` flag

## Standard Stack

### Core (Already in Place)

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Next.js | ^15.1 | App framework with standalone output | Configured in next.config.ts |
| `@neondatabase/serverless` | ^0.10 | HTTP driver for Neon runtime queries | Installed, used by db-adapter.ts |
| `postgres` | ^3.4.8 | TCP driver for migrations | Installed, used by drizzle-kit push |
| drizzle-kit | ^0.30 (db pkg) / ^0.31 (dashboard) | Schema push for migrations | Available via bunx |
| Vercel CLI | 41.4.1 | Project linking and deployment | Installed locally |

### Supporting (External Services)

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Neon Postgres | Production database | Managed via Neon dashboard or Vercel integration |
| Upstash Redis | Serverless cache (optional) | HTTP-based, works in Vercel serverless |
| Upstash QStash | Message queue (optional) | Webhook-based job scheduling |
| Vercel Cron | Scheduled automation | Already configured in vercel.json: `/api/cron/automation` every 5 min |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Neon Managed Integration | Manual Neon + manual env vars | Integration auto-injects DATABASE_URL and DATABASE_URL_UNPOOLED; manual setup is more work but gives full control |
| drizzle-kit push --force | drizzle-kit migrate (migration files) | push is simpler for alpha (no SQL files to review); migrate is safer for production data |

## Architecture Patterns

### Current Deployment Architecture

```
Vercel (Production)
  |
  +-- Build Phase:
  |     1. bun install (auto-detected from bun.lock)
  |     2. drizzle-kit push --force --url=$DATABASE_URL_UNPOOLED  (schema sync)
  |     3. turbo build --filter=@sessionforge/dashboard  (Next.js build)
  |
  +-- Runtime:
  |     +-- Serverless Functions (Node.js 22.x)
  |     |     +-- API routes (76+)
  |     |     +-- Agent routes (maxDuration: 300s)
  |     |     +-- Cron: /api/cron/automation (*/5 * * * *)
  |     |
  |     +-- Static Assets (.next/static, public/)
  |     |
  |     +-- Middleware (redirect-only, Edge runtime)
  |
  +-- External Services:
        +-- Neon Postgres (pooled for runtime, unpooled for build)
        +-- Upstash Redis (optional, HTTP transport)
        +-- Upstash QStash (optional, webhook transport)
        +-- Stripe (billing webhooks)
```

### Database Connection Strategy

```
                    Build Time                    Runtime
                    ----------                    -------
DATABASE_URL_UNPOOLED ──> drizzle-kit push    DATABASE_URL ──> @neondatabase/serverless
(direct, no pooler)       (DDL, SET stmts)    (pooled, PgBouncer)  (HTTP, one-shot queries)
```

The `db-adapter.ts` handles runtime driver selection automatically:
- If `DATABASE_URL` contains `neon.tech` -> uses `@neondatabase/serverless` (HTTP)
- If `DATABASE_DRIVER=postgres` or non-Neon URL -> uses `postgres` (TCP)
- No code changes needed for Vercel deployment

### Pattern: vercel.json Build Command Override

The existing vercel.json has `buildCommand: "cd apps/dashboard && bun run build"` which only builds the app. It must be updated to prepend the migration step:

```json
{
  "buildCommand": "cd packages/db && bunx drizzle-kit push --force --url=$DATABASE_URL_UNPOOLED && cd ../.. && turbo build --filter=@sessionforge/dashboard"
}
```

Key flags:
- `--force`: Skips interactive confirmation prompts (critical -- without this, build hangs)
- `--url=$DATABASE_URL_UNPOOLED`: Targets the direct Neon connection (not pooled)
- `turbo build --filter=@sessionforge/dashboard`: Builds only the dashboard app

### Pattern: Environment-Driven URL Resolution

All localhost:3000 references in the codebase use the fallback pattern `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`. This is correct -- as long as `NEXT_PUBLIC_APP_URL` is set in Vercel, no hardcoded URLs will leak. Found in 15+ files including auth, billing, OAuth callbacks, batch routes, and feeds.

### Anti-Patterns to Avoid

- **Running drizzle-kit push without --force in CI/build**: Hangs on interactive prompts for new enums. Documented bug in CLAUDE.md.
- **Using pooled DATABASE_URL for migrations**: PgBouncer transaction mode breaks DDL statements. Always use DATABASE_URL_UNPOOLED.
- **Forgetting BETTER_AUTH_URL**: Auth works but logs a warning in production. Must match NEXT_PUBLIC_APP_URL.
- **Setting DATABASE_DRIVER on Vercel**: Not needed -- db-adapter.ts auto-detects Neon URLs. Omit entirely or set to "neon".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Neon branch per PR | Custom branch management | Neon Managed Vercel Integration | Auto-creates preview branches, injects env vars, cleans up on merge |
| Schema migration in build | Custom migration script | `drizzle-kit push --force --url=...` | drizzle-kit handles schema diffing, DDL generation, and idempotent application |
| Healthcheck logic | New endpoint | Existing `/api/healthcheck` | Already tests DB + Redis with graceful degradation |
| Deployment validation | New endpoint | Existing `/api/deployment/validate` | Already checks required/optional vars, DB, Redis, detects deployment mode |
| Env var documentation | README section | `.env.example` | Comprehensive, already documents all vars with deployment mode hints |

## Existing Assets Audit

### What Already Exists and Works

| Asset | Location | Status | Notes |
|-------|----------|--------|-------|
| `vercel.json` | Root | EXISTS - needs buildCommand update | Has framework, functions, headers, regions, crons configured |
| `next.config.ts` | apps/dashboard/ | EXISTS - ready | `output: "standalone"`, `transpilePackages`, `serverExternalPackages` |
| `db-adapter.ts` | apps/dashboard/src/lib/ | EXISTS - ready | Auto-detects Neon URLs, dual-driver support |
| `/api/healthcheck` | apps/dashboard/src/app/api/ | EXISTS - ready | Tests DB + Redis, returns 200/503 with structured JSON |
| `/api/deployment/validate` | apps/dashboard/src/app/api/ | EXISTS - ready | Checks required/optional vars, DB, Redis, detects deployment mode |
| `.env.example` | Root | EXISTS - ready | Comprehensive documentation of all env vars |
| `Dockerfile` | Root | EXISTS - ready | 3-stage build, Phase 2 hardened |
| `docker-entrypoint.sh` | Root | EXISTS - ready | Runs migrations before app start (Docker only) |
| `drizzle.config.ts` | packages/db/ | EXISTS - ready | Reads DATABASE_URL from env |
| CI workflow | .github/workflows/ci.yml | EXISTS | Lint + typecheck + build + schema drift + Docker build |
| Cron route | apps/dashboard/src/app/api/cron/automation/ | EXISTS - ready | Protected by CRON_SECRET, 5-min schedule in vercel.json |
| Middleware | apps/dashboard/src/middleware.ts | EXISTS - ready | Redirect-only, lightweight, no external deps |

### What Does NOT Exist (Must Create/Configure)

| Item | Type | Action |
|------|------|--------|
| `.vercel/` project link | Config directory | `vercel link` or dashboard setup creates this |
| Neon database | External service | Provision via Neon dashboard or Vercel integration |
| Vercel env vars | Platform config | Set via `vercel env add` or dashboard |
| Production deployment | Platform | `vercel deploy --prod` or git push after linking |

### What Needs Modification

| Item | Change | Why |
|------|--------|-----|
| `vercel.json` buildCommand | Prepend `drizzle-kit push --force --url=$DATABASE_URL_UNPOOLED` | DEPL-04: Schema must sync before build |
| `vercel.json` installCommand | May need removal or update | Current `bun install` may conflict with Vercel auto-detection |

## Common Pitfalls

### Pitfall 1: drizzle-kit push Hangs in Non-Interactive Environment
**What goes wrong:** `drizzle-kit push` prompts for confirmation when creating new enums or columns. In Vercel's build environment, there is no TTY, so the command hangs indefinitely and the build times out.
**Why it happens:** Default behavior asks "Are you sure you want to add enum X?"
**How to avoid:** Use `--force` flag: `bunx drizzle-kit push --force --url=$DATABASE_URL_UNPOOLED`
**Warning signs:** Build hangs at "Applying changes..." step with no progress for >60 seconds.
**Confidence:** HIGH -- documented in CLAUDE.md, Phase 2 research, and verified via `drizzle-kit push --help` showing `--force` flag.

### Pitfall 2: Pooled Neon Connection for Migrations
**What goes wrong:** Neon's PgBouncer pooler runs in transaction mode. DDL statements (`CREATE TABLE`, `ALTER TABLE`, `CREATE TYPE`) and `SET` statements fail or produce unpredictable results through the pooler.
**Why it happens:** PgBouncer transaction mode does not support multi-statement transactions needed for schema changes.
**How to avoid:** Always use `DATABASE_URL_UNPOOLED` (direct connection) for `drizzle-kit push`. The Neon-Vercel integration automatically provides both `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
**Warning signs:** `drizzle-kit push` errors with "prepared statement does not exist" or hangs.
**Confidence:** HIGH -- verified in prior project research (PITFALLS.md Pitfall 14) and Neon documentation.

### Pitfall 3: Missing NEXT_PUBLIC_APP_URL Breaks Auth and OAuth
**What goes wrong:** 15+ files use `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"` for OAuth callbacks, billing redirects, and RSS feeds. If `NEXT_PUBLIC_APP_URL` is not set, all these URLs point to localhost.
**Why it happens:** `NEXT_PUBLIC_` vars are inlined at build time by Next.js. If not set during `next build`, the fallback value gets baked into the production bundle.
**How to avoid:** Set `NEXT_PUBLIC_APP_URL` in Vercel env vars before the first production build. Must be the full production URL (e.g., `https://sessionforge.vercel.app`).
**Warning signs:** OAuth callbacks redirect to localhost:3000; Stripe billing portal returns to localhost.
**Confidence:** HIGH -- verified by grepping codebase, 15+ occurrences found.

### Pitfall 4: BETTER_AUTH_URL Not Set
**What goes wrong:** `auth.ts` logs a warning in production if `BETTER_AUTH_URL` is not set, falling back to `NEXT_PUBLIC_APP_URL`. While functional, this can cause issues with server-side auth URL resolution.
**Why it happens:** Better Auth uses `BETTER_AUTH_URL` for server-side operations. It's separate from the client-side `NEXT_PUBLIC_APP_URL`.
**How to avoid:** Set `BETTER_AUTH_URL` equal to the production URL in Vercel env vars.
**Warning signs:** Console warning: "[auth] WARNING: BETTER_AUTH_URL is not set in production."
**Confidence:** HIGH -- verified directly in auth.ts source code.

### Pitfall 5: Vercel Function Duration Limits
**What goes wrong:** Several routes set `maxDuration: 300` (5 minutes). The Vercel Hobby plan caps function duration at 60 seconds regardless of this setting.
**Why it happens:** `maxDuration` is only respected on Vercel Pro plan and above.
**How to avoid:** Ensure the Vercel project is on Pro plan if AI agent routes or pipeline analysis need to run (300s timeout). For alpha with `DISABLE_AI_AGENTS=true`, this is less critical since only the cron/automation routes need extended duration.
**Warning signs:** 504 Gateway Timeout on agent routes or pipeline analysis.
**Confidence:** HIGH -- vercel.json already sets maxDuration: 300 for agent/session/insight routes.

### Pitfall 6: Build Command Working Directory
**What goes wrong:** The build command must navigate correctly within the monorepo. `cd packages/db && bunx drizzle-kit push` runs from the packages/db directory where drizzle.config.ts lives, but `turbo build` must run from the repo root.
**Why it happens:** Vercel clones the repo and runs the build command from the root. The `cd` commands must chain properly.
**How to avoid:** Use `&&` to chain: `cd packages/db && bunx drizzle-kit push --force --url=$DATABASE_URL_UNPOOLED && cd ../.. && turbo build --filter=@sessionforge/dashboard`
**Warning signs:** "drizzle.config.ts not found" or "turbo: command not found".
**Confidence:** HIGH -- verified directory structure and build scripts.

## Code Examples

### vercel.json - Updated Build Command

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "bun install",
  "buildCommand": "cd packages/db && bunx drizzle-kit push --force --url=$DATABASE_URL_UNPOOLED && cd ../.. && turbo build --filter=@sessionforge/dashboard",
  "outputDirectory": "apps/dashboard/.next",
  "functions": {
    "apps/dashboard/src/app/api/agents/**/*.ts": { "maxDuration": 300 },
    "apps/dashboard/src/app/api/content/mine-sessions/**/*.ts": { "maxDuration": 300 },
    "apps/dashboard/src/app/api/sessions/scan/**/*.ts": { "maxDuration": 300 },
    "apps/dashboard/src/app/api/insights/extract/**/*.ts": { "maxDuration": 300 }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ],
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/cron/automation",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Source: Existing vercel.json with buildCommand updated per D-02 and prior research (STACK.md).

### Required Vercel Environment Variables

```
# REQUIRED (app won't start without these)
DATABASE_URL=<auto-injected by Neon integration - pooled>
DATABASE_URL_UNPOOLED=<auto-injected by Neon integration - direct>
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://<production-url>
NEXT_PUBLIC_APP_URL=https://<production-url>

# AI (disable on Vercel - Claude CLI not available)
DISABLE_AI_AGENTS=true

# OPTIONAL (features degrade gracefully without these)
# UPSTASH_REDIS_URL=https://<upstash-endpoint>
# UPSTASH_REDIS_TOKEN=<upstash-token>
# CRON_SECRET=<openssl rand -hex 32>
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# GITHUB_CLIENT_ID=<github-oauth-app-id>
# GITHUB_CLIENT_SECRET=<github-oauth-app-secret>
```

### Vercel CLI Deployment Flow

```bash
# 1. Link project (creates .vercel/ directory)
vercel link

# 2. Add env vars (or use dashboard)
vercel env add BETTER_AUTH_SECRET production
vercel env add BETTER_AUTH_URL production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add DISABLE_AI_AGENTS production

# 3. Deploy to production
vercel deploy --prod

# 4. Verify
curl https://<production-url>/api/healthcheck
curl https://<production-url>/api/deployment/validate
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle-kit push` (interactive) | `drizzle-kit push --force` (non-interactive) | drizzle-kit 0.30+ | `--force` auto-approves data loss statements; essential for CI/build environments |
| Manual Neon env vars | Neon Managed Vercel Integration | Available now | Auto-injects DATABASE_URL and DATABASE_URL_UNPOOLED per environment |
| `bun run build` in vercel.json | `turbo build --filter=...` | Current | Proper monorepo build that resolves workspace dependencies |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel CLI | Project linking/deploy | Yes | 41.4.1 | Use Vercel dashboard instead |
| Bun | Install/build | Yes | 1.3.6 (local), 1.2.4 (lockfile) | Vercel auto-detects from bun.lock |
| Node.js | Runtime | Yes | v25.8.1 (local), 22.x (Vercel target) | -- |
| drizzle-kit | Schema push | Yes (via bunx) | 0.30.6 | -- |
| Neon Postgres | Production database | External service | -- | Must provision |
| Upstash Redis | Cache (optional) | External service | -- | App runs without Redis (graceful fallback) |

**Missing dependencies with no fallback:**
- Neon Postgres database -- must be provisioned before deploy (blocks DEPL-02, DEPL-03)

**Missing dependencies with fallback:**
- Upstash Redis -- app runs without it (healthcheck reports "ok" when Redis not configured)
- Upstash QStash -- app falls back to Vercel Cron for scheduling (already configured)
- Stripe -- billing features degrade gracefully without keys

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Functional validation via real endpoints (per project mandate) |
| Config file | N/A -- no test files per CLAUDE.md |
| Quick run command | `curl <url>/api/healthcheck` |
| Full suite command | `curl <url>/api/deployment/validate` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPL-01 | App accessible at production URL | smoke | `curl -sf https://<url>/ -o /dev/null -w '%{http_code}'` | N/A (curl) |
| DEPL-02 | Neon database provisioned | manual | Check Neon dashboard for production branch | N/A (manual) |
| DEPL-03 | Pooled runtime + unpooled migrations | smoke | `curl https://<url>/api/deployment/validate \| jq .mode` | Endpoint exists |
| DEPL-04 | Build command includes drizzle-kit push | manual | Verify vercel.json buildCommand field + Vercel build logs | N/A (config check) |
| DEPL-05 | All required env vars configured | smoke | `curl https://<url>/api/deployment/validate \| jq .checks.required` | Endpoint exists |
| DEPL-06 | Healthcheck returns 200 | smoke | `curl -sf https://<url>/api/healthcheck -w '%{http_code}'` | Endpoint exists |
| DEPL-07 | Deployment validates all services | smoke | `curl https://<url>/api/deployment/validate \| jq .status` | Endpoint exists |

### Sampling Rate
- **Per task commit:** `curl <url>/api/healthcheck`
- **Per wave merge:** `curl <url>/api/deployment/validate` + verify mode is "neon-managed"
- **Phase gate:** All DEPL-* requirements verified via endpoint responses

### Wave 0 Gaps
None -- existing healthcheck and deployment/validate endpoints cover all automated checks. No test framework or test files needed (per project mandate).

## Open Questions

1. **Vercel Plan Tier**
   - What we know: vercel.json sets `maxDuration: 300` for agent routes. Hobby plan caps at 60s.
   - What's unclear: Which Vercel plan the project will use.
   - Recommendation: For alpha with `DISABLE_AI_AGENTS=true`, Hobby plan works (agent routes disabled). If agent routes are needed later, Pro plan required. Document this dependency.

2. **Neon Scale-to-Zero**
   - What we know: DEPL-02 says "scale-to-zero disabled" for production branch.
   - What's unclear: Whether Neon Free plan supports disabling scale-to-zero (it may require paid plan).
   - Recommendation: If using Neon Free, accept the cold start latency (~500ms on first query after idle). Document in deployment notes.

3. **vercel.json installCommand Redundancy**
   - What we know: vercel.json has `"installCommand": "bun install"`. Vercel auto-detects bun from bun.lock.
   - What's unclear: Whether explicit installCommand conflicts with or overrides auto-detection.
   - Recommendation: Keep it explicit for clarity. If install issues occur, try removing it.

4. **drizzle-kit push --force Safety for First Deploy**
   - What we know: `--force` auto-approves data loss statements. On a fresh Neon database this is harmless (no data to lose).
   - What's unclear: On subsequent deploys with schema changes, `--force` could drop columns without warning.
   - Recommendation: For alpha, `--force` is acceptable since the database is new and has no user data. Before GA, switch to `drizzle-kit migrate` with reviewed migration files.

## Sources

### Primary (HIGH confidence)
- Codebase files read directly: vercel.json, next.config.ts, db-adapter.ts, healthcheck route, deployment/validate route, auth.ts, auth-client.ts, drizzle.config.ts, package.json (root + dashboard + db), .env.example, Dockerfile, docker-entrypoint.sh, middleware.ts, redis.ts, qstash.ts, cron/automation route, ci.yml
- `drizzle-kit push --help` output: verified `--force` flag exists and its behavior
- Prior project research: .planning/research/STACK.md, .planning/research/PITFALLS.md

### Secondary (MEDIUM confidence)
- Neon connection pooling behavior (from prior research, cross-verified with codebase patterns)
- Vercel monorepo build detection (from prior research in STACK.md)

### Tertiary (LOW confidence)
- Neon scale-to-zero configuration on free vs paid plans (not verified against current docs)
- Exact behavior of `installCommand` vs auto-detection interaction (may need testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already installed and configured in codebase
- Architecture: HIGH -- db-adapter.ts, healthcheck, deployment/validate all verified by reading source
- Pitfalls: HIGH -- drizzle-kit push hanging documented in CLAUDE.md and verified via --help; pooled connection issue from prior research
- Build command: HIGH -- verified directory structure, drizzle.config.ts location, turbo.json config
- Env vars: HIGH -- exhaustive .env.example already documents everything; deployment/validate endpoint checks them

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable deployment configuration, no fast-moving APIs)
