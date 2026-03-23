# Phase 3: Vercel + Neon Deployment - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Source:** Auto-generated from ROADMAP requirements (--auto mode)

<domain>
## Phase Boundary

Deploy SessionForge to Vercel production with Neon Postgres. Wire schema migrations into the build command. Verify all services are connected and endpoints respond. This phase takes the Docker-hardened codebase and makes it live on the internet.

</domain>

<decisions>
## Implementation Decisions

### Vercel Project Setup
- **D-01:** Use Vercel CLI or dashboard to create/link the project — the app already has `output: "standalone"` in next.config.ts
- **D-02:** Build command must run `drizzle-kit push` before `turbo build` — this ensures schema is synced before the app builds (per DEPL-04)

### Neon Database
- **D-03:** Provision Neon Postgres with pooled connection string for runtime and unpooled/direct for migrations — the db-adapter.ts already supports DATABASE_DRIVER switching
- **D-04:** Use `@neondatabase/serverless` for runtime (already in deps) and standard postgres connection for migrations

### Environment Variables
- **D-05:** All required env vars from .env.example must be configured in Vercel project — use the comprehensive list from Phase 2's rewritten .env.example
- **D-06:** `DATABASE_DRIVER` should NOT be set (or set to "neon") for Vercel — the db-adapter auto-detects Neon URLs

### Verification Endpoints
- **D-07:** `/api/healthcheck` must return 200 on production — already exists, was fixed in Phase 2 for Redis detection
- **D-08:** `/api/deployment/validate` must confirm all services connected — already exists in codebase

### Claude's Discretion
- Exact Vercel project name and domain
- Whether to use Vercel CLI or dashboard for initial setup
- Build timeout and function configuration
- Whether to enable Vercel Analytics/Speed Insights

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deployment Config
- `apps/dashboard/next.config.ts` — standalone output, server external packages
- `Dockerfile` — Reference for how the build works (3-stage, bun-based)
- `.env.example` — Comprehensive env var list (rewritten in Phase 2)
- `.env.self-hosted.example` — Self-hosted env reference

### Database
- `apps/dashboard/src/lib/db-adapter.ts` — Dual-driver (Neon HTTP vs postgres-js)
- `packages/db/src/schema.ts` — 3032-line converged schema
- `packages/db/package.json` — db:push script

### Healthcheck
- `apps/dashboard/src/app/api/healthcheck/route.ts` — Healthcheck endpoint (Phase 2 fixed Redis detection)
- `apps/dashboard/src/app/api/deployment/validate/route.ts` — Deployment validation endpoint

### Build
- `turbo.json` — Turbo pipeline config
- `package.json` — Root workspace config with build scripts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db-adapter.ts` auto-detects Neon URLs — no code changes needed for Vercel deployment
- Healthcheck and deployment/validate endpoints already exist and work
- `.env.example` comprehensively documents all required vars (Phase 2)

### Established Patterns
- Next.js standalone output already configured
- `DISABLE_AI_AGENTS=true` gracefully disables AI when Claude CLI unavailable (production)
- `serverExternalPackages: ["ssh2"]` already configured

### Integration Points
- Build pipeline: `drizzle-kit push` → `turbo build` (must be in Vercel build command)
- Neon connection: pooled for runtime, direct for push
- Env vars: Vercel dashboard or CLI configuration

</code_context>

<specifics>
## Specific Ideas

- This phase is primarily configuration/deployment, not code changes
- Most code changes were already done in Phase 2 (Docker hardening)
- Key risk: ensuring drizzle-kit push doesn't hang on Neon (it shouldn't since Neon is a real Postgres)
- AI agents will be disabled in production (DISABLE_AI_AGENTS=true) since Claude CLI auth isn't available on Vercel

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-vercel-neon-deployment*
*Context gathered: 2026-03-23*
