---
phase: 03-vercel-neon-deployment
plan: 01
subsystem: infra
tags: [vercel, drizzle-kit, neon, postgres, migrations, ci-cd]

# Dependency graph
requires:
  - phase: 02-docker-hardening
    provides: Dockerfile and compose with auto-migration entrypoint
provides:
  - Vercel build pipeline that syncs Neon schema before building the app
affects: [03-vercel-neon-deployment, 04-documentation-release]

# Tech tracking
tech-stack:
  added: []
  patterns: [build-time schema migration via drizzle-kit push --force]

key-files:
  created: []
  modified: [vercel.json]

key-decisions:
  - "Use --force flag to skip interactive prompts in CI (drizzle-kit hangs without it)"
  - "Use DATABASE_URL_UNPOOLED for migrations (pooled connections break DDL through PgBouncer)"
  - "Use turbo build --filter instead of direct bun run build for proper monorepo workspace resolution"

patterns-established:
  - "Build-time migration: always push schema before app build in Vercel pipeline"
  - "Unpooled connections for DDL: migrations use direct connection, app uses pooled"

requirements-completed: [DEPL-04, DEPL-03]

# Metrics
duration: 1min
completed: 2026-03-23
---

# Phase 03 Plan 01: Vercel Build Pipeline Summary

**Vercel buildCommand chains drizzle-kit push --force against unpooled Neon URL before turbo build for automated schema sync on deploy**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-23T07:57:54Z
- **Completed:** 2026-03-23T07:58:40Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Updated vercel.json buildCommand to run schema migrations before app build
- Migrations target DATABASE_URL_UNPOOLED (direct Neon connection, required for DDL statements)
- Build uses turbo build --filter=@sessionforge/dashboard for proper monorepo workspace resolution
- All other vercel.json config preserved (framework, functions, headers, regions, crons)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update vercel.json buildCommand with migration pipeline** - `2c5fdd1` (feat)

## Files Created/Modified
- `vercel.json` - Updated buildCommand to chain drizzle-kit push --force then turbo build

## Decisions Made
- Used `--force` flag on drizzle-kit push to prevent interactive prompt hangs in CI (documented in CLAUDE.md as known issue)
- Used `--url=$DATABASE_URL_UNPOOLED` to override drizzle.config.ts default DATABASE_URL with the unpooled connection, since pooled connections (PgBouncer) break DDL statements
- Switched from `cd apps/dashboard && bun run build` to `turbo build --filter=@sessionforge/dashboard` for proper monorepo build with workspace dependency resolution

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The DATABASE_URL_UNPOOLED env var is auto-provided by the Neon-Vercel integration.

## Next Phase Readiness
- Build pipeline ready for first Vercel deployment
- Next plans in this phase will configure environment variables and verify the deployment

## Self-Check: PASSED

- FOUND: vercel.json
- FOUND: 03-01-SUMMARY.md
- FOUND: commit 2c5fdd1

---
*Phase: 03-vercel-neon-deployment*
*Completed: 2026-03-23*
