# Phase 2: Docker Hardening - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix known container defects, add auto-migration on startup, and achieve a zero-step `docker compose up` experience from a clean clone. Postgres starts, schema auto-migrates, app serves at localhost:3000, healthchecks pass. No manual steps between `git clone` and working app.

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- **D-01:** Use generated migration files (not drizzle-kit push) for auto-migration — drizzle-kit push is interactive and hangs on prompts for new enums/columns. Phase 1 already generated fresh migrations from the converged schema. The entrypoint script runs `bun run src/migrate.ts` from the db package before starting the app server.
- **D-02:** Entrypoint script pattern — a shell script (`docker-entrypoint.sh`) runs migrations then exec's the node server. This keeps the Dockerfile CMD clean and allows the migration step to be skipped via env var if needed.

### Runner Image
- **D-03:** Upgrade from node:20-slim to node:22-slim (per DOCK-06 requirement). Node 22 is the current LTS.

### Sharp Installation
- **D-04:** Install sharp's native dependencies (libvips) in the runner stage. Sharp is already in dashboard dependencies and is required for next/image optimization. The node:22-slim image needs `libc6` and platform-specific sharp binaries.

### CLAUDECODE Environment
- **D-05:** Clear CLAUDECODE env var in the Dockerfile runner stage (`ENV CLAUDECODE=`) to prevent the nested-session rejection bug when AI agents are enabled in containers. This is a known requirement from Phase 1 (all 15 AI files have `delete process.env.CLAUDECODE`).

### Compose File Strategy
- **D-06:** Keep `docker-compose.yml` as the primary dev compose file — this is the file users run with `docker compose up` (DOCK-01 target). Keep `docker-compose.self-hosted.yml` for production self-hosted deployments with Redis. Remove or rename `docker-compose.prod.yml` if it duplicates self-hosted functionality.
- **D-07:** Redis stays optional in dev compose — the app already has graceful Redis fallback (placeholders when Redis unavailable). Adding Redis to dev compose adds unnecessary weight for most development workflows. Self-hosted compose includes Redis for production use.

### Database Driver
- **D-08:** Docker compose sets `DATABASE_DRIVER=postgres` explicitly — the db-adapter.ts (`apps/dashboard/src/lib/db-adapter.ts`) already auto-switches between Neon HTTP driver and standard postgres-js driver based on this env var. No code changes needed, just correct env var in compose.

### Environment Variables
- **D-09:** `.env.example` must document every required env var with clear categories (required vs optional). The existing `.env.self-hosted.example` is well-structured — align `.env.example` to match for Docker dev use. Include inline comments explaining when each var is needed.

### Claude's Discretion
- Exact entrypoint script structure (bash vs sh, error handling approach)
- Whether to use `--force` on drizzle-kit push if migration files approach doesn't work
- Build cache optimization in Dockerfile (layer ordering, .dockerignore)
- Whether to add a `.dockerignore` file (recommended for build performance)
- Health check timing parameters (intervals, retries, start period)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Docker Files
- `Dockerfile` — Existing 3-stage multi-build (deps → build → runner). Needs: node:22-slim upgrade, sharp deps, CLAUDECODE clearing, entrypoint script
- `docker-compose.yml` — Dev compose (postgres + app). Needs: auto-migration, env var alignment
- `docker-compose.self-hosted.yml` — Production compose (postgres + redis + app). Already more complete
- `docker-compose.prod.yml` — Review for consolidation/removal

### Environment Config
- `.env.example` — Neon-focused env vars. Needs alignment with Docker dev use
- `.env.self-hosted.example` — Comprehensive self-hosted env vars (good reference structure)

### Database
- `apps/dashboard/src/lib/db-adapter.ts` — Dual-driver pattern (Neon HTTP vs postgres-js). Already handles DATABASE_DRIVER switching
- `apps/dashboard/src/lib/db.ts` — Re-exports from db-adapter
- `packages/db/src/schema.ts` — 3032-line converged schema (source of truth)
- `packages/db/src/index.ts` — Barrel export
- `packages/db/package.json` — Has `db:push`, `db:generate`, `db:migrate` scripts

### Migration
- `packages/db/migrations/` — Freshly generated migration files from Phase 1 convergence
- `packages/db/src/migrate.ts` — Migration runner script (non-interactive)

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — Full architecture overview
- `.planning/codebase/STACK.md` — Technology stack details
- `.planning/codebase/CONCERNS.md` — Known bugs and tech debt

### Phase 1 Output
- `.planning/phases/01-worktree-convergence/01-CONVERGENCE-REPORT.md` — Final convergence state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db-adapter.ts` — Already handles Neon vs Postgres driver switching (no code changes needed for Docker)
- `docker-compose.self-hosted.yml` — Well-structured production compose with healthchecks, restart policies, volume persistence
- `.env.self-hosted.example` — Comprehensive env var documentation (good template for .env.example alignment)
- `Dockerfile` — Working 3-stage build, just needs targeted fixes (image version, sharp, entrypoint)

### Established Patterns
- Next.js standalone output mode already configured (`output: "standalone"` in next.config.ts)
- Healthcheck endpoint exists at `/api/healthcheck`
- Deployment validation at `/api/deployment/validate`
- `DISABLE_AI_AGENTS=true` gracefully disables all AI features
- `DATABASE_DRIVER` env var controls driver selection (already in compose files)

### Integration Points
- Migration entry: `packages/db/src/migrate.ts` — runs migration files against DATABASE_URL
- App entry: `apps/dashboard/server.js` — Next.js standalone server (in .next/standalone/)
- Healthcheck: `GET /api/healthcheck` — used by Docker HEALTHCHECK directive
- Static files: `.next/static` and `public/` — copied to standalone output in Dockerfile

</code_context>

<specifics>
## Specific Ideas

- The main blocker is auto-migration: currently users must manually run `drizzle-kit push` after compose up, which hangs on interactive prompts for new enums. Using the migration files approach (src/migrate.ts) avoids this entirely.
- node:20-slim → node:22-slim is a straightforward base image swap but needs sharp native deps added
- The CLAUDECODE env var bug only matters when AI agents are enabled in containers (DISABLE_AI_AGENTS=false), but clearing it defensively is cheap insurance
- docker-compose.prod.yml should be reviewed — it may be redundant with self-hosted compose

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-docker-hardening*
*Context gathered: 2026-03-23*
