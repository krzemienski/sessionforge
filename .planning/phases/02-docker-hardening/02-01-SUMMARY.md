---
phase: 02-docker-hardening
plan: 01
subsystem: infra
tags: [docker, node22, migrations, drizzle, postgres, entrypoint]

# Dependency graph
requires:
  - phase: 01-worktree-convergence
    provides: merged schema.ts with all 30+ tables, production build passing
provides:
  - Buildable Docker image with node:22-slim runner
  - Migration runner script (packages/db/src/migrate.ts)
  - Entrypoint script that auto-runs migrations before app start
  - CLAUDECODE env var cleared in runner stage
affects: [02-docker-hardening, 03-deployment]

# Tech tracking
tech-stack:
  added: [postgres ^3.4.8 in packages/db]
  patterns: [entrypoint-driven migration, inline node -e for CJS in slim images]

key-files:
  created:
    - packages/db/src/migrate.ts
    - docker-entrypoint.sh
  modified:
    - Dockerfile
    - packages/db/package.json
    - bun.lock

key-decisions:
  - "node:22-slim runner base (Node 22 LTS, not node:20)"
  - "Inline CJS require() in entrypoint (no ESM loader in node -e context)"
  - "postgres as direct dependency of @sessionforge/db (not just hoisted from dashboard)"
  - "HEALTHCHECK start-period=30s to allow migration time on first boot"

patterns-established:
  - "Migration entrypoint pattern: docker-entrypoint.sh runs node -e with CJS require before exec $@"
  - "CLAUDECODE clearing pattern: ENV CLAUDECODE='' in Dockerfile runner stage"

requirements-completed: [DOCK-02, DOCK-05, DOCK-06]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 2 Plan 1: Dockerfile Fix and Migration Infrastructure Summary

**Multi-stage Dockerfile with node:22-slim runner, CLAUDECODE cleared, entrypoint-driven Drizzle migrations via postgres-js driver**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T06:51:16Z
- **Completed:** 2026-03-23T06:52:59Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created migration runner script (packages/db/src/migrate.ts) using drizzle-orm/postgres-js/migrator
- Added postgres as direct dependency of @sessionforge/db for Docker standalone builds
- Upgraded Dockerfile runner from node:20-slim to node:22-slim (Node 22 LTS)
- Created docker-entrypoint.sh that runs migrations before starting the app
- Cleared CLAUDECODE env var in runner stage to prevent nested-session rejection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration runner and add postgres dependency** - `5c0aac1` (feat)
2. **Task 2: Fix Dockerfile and create entrypoint script** - `94e0eb1` (feat)

## Files Created/Modified
- `packages/db/src/migrate.ts` - Drizzle migration runner using postgres-js driver with max:1 connection
- `packages/db/package.json` - Added postgres ^3.4.8 as direct dependency
- `bun.lock` - Updated lockfile with postgres dependency
- `Dockerfile` - Upgraded to node:22-slim, CLAUDECODE cleared, migration COPY, entrypoint
- `docker-entrypoint.sh` - Runs inline Node.js CJS migration script then exec's CMD

## Decisions Made
- Used node:22-slim (Node 22 LTS) instead of node:20-slim per research finding D-03
- Used inline CJS `require()` in entrypoint script because `node -e` does not support ESM imports
- Added postgres as direct dependency of packages/db since standalone output does not trace it from the dashboard workspace
- Set HEALTHCHECK start-period to 30s (up from 10s) to allow migration time on first boot
- Used absolute path `/app/packages/db/migrations` in entrypoint (vs relative in migrate.ts) since entrypoint runs from /app

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Docker image is now buildable with `docker build -t sessionforge:test .`
- Migration infrastructure ready for docker compose integration (plan 02)
- Entrypoint pattern established for zero-step startup
- Ready for compose file creation with local Postgres and env var injection

## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 02-docker-hardening*
*Completed: 2026-03-23*
