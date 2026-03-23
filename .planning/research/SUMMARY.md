# Project Research Summary

**Project:** SessionForge v0.1.0-alpha
**Domain:** Convergence, containerization, and deployment of an existing Next.js 15 Bun monorepo with 10 active worktrees
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

SessionForge is an AI-powered session-to-content pipeline platform that is already extensively built — 21 pages, 76+ API routes, 30 database tables, 6 AI agents, and 50+ features across a Bun monorepo. The v0.1.0-alpha goal is not greenfield construction but convergence and shipping: merging 10 active worktrees, hardening the container build, wiring the production Vercel+Neon deployment, and validating that existing features work end-to-end. The recommended approach is strictly sequential — converge first, then containerize, then deploy — because each phase depends on a stable codebase from the previous one.

The infrastructure is 80–90% complete. The Dockerfile uses a correct 3-stage multi-stage build, docker-compose files cover local dev and self-hosted scenarios, the `db-adapter.ts` dual-driver pattern cleanly switches between Neon HTTP and postgres-js, and GitHub Actions CI already handles lint, typecheck, schema drift, and Docker build. The primary gaps are: a missing auto-migration step in Docker Compose, the runner image using Node 20 instead of 22, `sharp` not installed in the runner stage, and a CI smoke test that never actually starts the container stack. None of these are hard problems — they are known patterns with well-documented fixes.

The highest-risk area is worktree convergence. Seven of ten worktrees are 382 lines behind main in `schema.ts`, three branches make independent schema modifications that will conflict at merge, and branch 038 contains 15,397 lines of test files that violate the project's no-mock mandate. Schema merge conflicts in Drizzle are particularly dangerous because `journal.json` and `snapshot.json` require linear migration history — hand-editing migration artifacts after parallel branch merges is error-prone and can silently corrupt the schema state. The mitigation is a strict merge order (non-schema branches first, schema branches last) with full build validation and migration regeneration after each merge.

## Key Findings

### Recommended Stack

No new packages are needed for alpha. The entire stack is already installed. The required changes are version upgrades and configuration adjustments in existing infrastructure files.

**Core technologies:**
- `oven/bun:1.2.4-slim` (Docker build stages) — matches the project's locked `packageManager: "bun@1.2.4"`; do not upgrade to 1.3.x as `--frozen-lockfile` will reject version mismatches
- `node:22-slim` (Docker runner stage) — upgrade from the current `node:20-slim`; Node 20 enters maintenance LTS and reaches EOL April 2026; Node 22 is active LTS through April 2027
- `postgres:17-alpine` (local dev) — upgrade from current `postgres:16-alpine` to match Neon production which runs Postgres 17
- `@neondatabase/serverless` + `postgres` (dual-driver) — already installed; the existing `db-adapter.ts` pattern is correct and production-ready
- Neon Managed Vercel Integration — handles preview branch creation, env var injection, and branch cleanup automatically; use pooled URL for runtime, unpooled for `drizzle-kit push`
- `oven-sh/setup-bun@v2` (CI) — upgrade from `@v1` used in `e2e.yml`; reads Bun version from `packageManager` field automatically

**What NOT to use:**
- `node:22-alpine` for the runner — `sharp` native bindings require glibc; Alpine is officially experimental for Node.js
- Turbopack (`--turbopack`) — documented drizzle-orm relation bug in Bun monorepos; `next dev` only
- `drizzle-kit push` against pooled Neon connection — PgBouncer transaction mode breaks DDL statements; always use the direct (unpooled) URL for migrations

### Expected Features

SessionForge already has all table-stakes features built. The alpha goal is validation, not construction.

**Must validate for alpha (already built, need end-to-end verification):**
- Session JSONL ingestion and AI content generation (6 agents: blog, social, newsletter, changelog, repurpose, editor-chat)
- Lexical editor with split/preview mode and live AI chat with streaming tool use
- Post-editing controls (make longer/shorter, length presets, free-text feedback, clarity improvement) — verified in `inline-edit-controls.tsx`
- Edit history with restore — full revision system built (`revision-history-panel.tsx`, `revisions/manager.ts`, API routes)
- Visual diff viewer (inline + side-by-side) — `diff-viewer.tsx` and `side-by-side-diff-viewer.tsx` exist
- Docker `compose up` from clean clone — currently missing auto-migration step (critical gap)
- Vercel production deployment — not yet deployed

**Should ship with alpha (pending worktree merges):**
- Worktree 041: mobile-responsive dashboard
- Worktree 035: content versioning visual diff enhancements
- Worktree 037: WCAG accessibility compliance (low-risk, UI-only)

**Defer to post-alpha:**
- Worktrees 031 (A/B headlines), 032 (compliance/billing), 034 (voice calibration), 036 (series filtering), 039 (structured data), 040 (AI repurposing) — merge only if clean
- Worktree 038 — do not merge; 15,397 lines of test files violates project mandate
- Rate limiting, paid feature enforcement, build-time env validation, graceful shutdown — explicitly out of scope

**Anti-features confirmed:**
- No E2E test suite (project mandate)
- No graceful shutdown (broken in Next.js standalone, GitHub issues #38298, #54522)
- No build-time env validation (runtime `/api/deployment/validate` endpoint is sufficient for alpha)
- No database seeding (alpha users bring their own sessions)

### Architecture Approach

Single container deployment with sidecar infrastructure. The Next.js app runs as one standalone container (`node apps/dashboard/server.js`), Postgres and Redis run as sidecar containers in Docker Compose. On Vercel, the same app deploys as serverless functions with Neon for database and Upstash for cache. The dual-driver pattern in `db-adapter.ts` handles environment switching with zero code changes — `DATABASE_DRIVER=neon` for Vercel, `DATABASE_DRIVER=postgres` for Docker.

**Major components:**
1. `apps/dashboard` (Next.js standalone) — SSR, API routes, AI agent execution; single deployable unit
2. `packages/db` (Drizzle schema + adapter) — build-time dependency; `db-adapter.ts` selects neon-http or postgres-js at runtime
3. Docker Compose services (postgres:17, redis:7) — local dev and self-hosted infrastructure sidecars
4. Neon branch hierarchy (main → dev → preview/pr-N) — managed by Neon-Vercel integration per PR
5. GitHub Actions CI (lint → typecheck+build → docker-build+smoke → schema-drift) — gates all merges

**Key architectural decisions:**
- Do not use SQL init scripts for schema — `drizzle-kit push` after Postgres starts is the single source of truth
- Do not use Docker for Next.js hot-reload development — `bun run dev` locally is the dev experience; Docker is for production builds and CI
- Build command for Vercel: `cd packages/db && bunx drizzle-kit push --url=$DATABASE_URL_UNPOOLED && cd ../.. && turbo build --filter=@sessionforge/dashboard` — migrations run against unpooled URL before build

**Merge order for worktrees (by conflict risk, lowest first):**
1. Non-schema UI branches: 037 (a11y), 041 (mobile), 036 (series filtering)
2. Schema-touching branches: 035 (versioning UI), 031 (A/B), 034 (voice)
3. Cross-cutting branches: 039 (SEO/meta), 040 (new agent), 032 (billing)
4. Skip: 038 (test files — project mandate violation)

### Critical Pitfalls

1. **Drizzle schema conflicts across 3 worktrees** — branches 031, 034, and 040 each modified `schema.ts` independently from a stale base. Drizzle's `journal.json` and `snapshot.json` require linear migration history. After merging each schema-modifying branch, delete all migration files and regenerate from scratch with `bunx drizzle-kit generate && bunx drizzle-kit push`. Never hand-edit journal files.

2. **CLAUDECODE env var in Docker and Vercel** — the `delete process.env.CLAUDECODE` lines in 13 source files are runtime fixes, not build-time fixes. If the container is built or deployed from inside a Claude Code session, the env var may persist and silently break all 6 AI agents (exit code 1, no error surfaced). Fix: add `ENV CLAUDECODE=""` to the Dockerfile runner stage and `CLAUDECODE: ""` to all docker-compose environment sections.

3. **7 of 10 worktrees are 382 lines behind main in schema.ts** — every merge will conflict in the schema file regardless of whether the branch touches schema. Accept main's `schema.ts` as base for each merge, then cherry-pick the branch's schema additions on top. Run `git merge-tree` before each merge to preview conflicts without modifying the working tree.

4. **Neon driver lacks true transactions on neon-http** — `db-adapter.ts` casts `pgDrizzle()` as `NeonHttpDatabase` with `as unknown as`, hiding the fact that neon-http executes each query as an independent HTTP request. Multi-table writes in `db.transaction()` work locally with postgres-js but may produce partial writes on Neon. Audit all `db.transaction()` call sites before declaring the Vercel deployment production-ready.

5. **Standalone output missing workspace packages and sharp** — Next.js file tracing may miss `@sessionforge/db` (workspace symlink) and `sharp` (native module). Verification: `docker exec <id> ls node_modules/@sessionforge/db` and `docker exec <id> node -e "require('sharp')"`. Fix: add `sharp` to dashboard `package.json` dependencies and add `outputFileTracingIncludes` in `next.config.ts`.

6. **Branch 038 violates no-mock mandate** — 15,397 insertions across 28 files. Audit with `git diff main...auto-claude/038 --name-only` before any merge decision. If predominantly `.test.ts` files, discard the branch entirely.

## Implications for Roadmap

Based on combined research, the dependency chain is unambiguous: you cannot containerize divergent code, and you cannot deploy until the container is proven. This dictates four sequential phases.

### Phase 1: Worktree Convergence

**Rationale:** All other phases depend on a stable, unified codebase. Containerizing or deploying any of the 10 divergent branches is wasted work — each would produce a different build artifact.

**Delivers:** Single stable `main` branch incorporating all alpha-scope worktrees, with a clean Drizzle schema that passes `drizzle-kit check`, and a successful production build.

**Addresses features:** All "should ship" worktrees (037, 041, 035); defers or skips risky ones (038, 031, 032, 034, 036, 039, 040)

**Avoids pitfalls:** Schema merge conflicts (Pitfall 1), stale-branch conflicts (Pitfall 9), 038 test file mandate violation (Pitfall 13)

**Research flag:** No additional research needed. Merge protocol is well-understood; conflict resolution is manual, not technical.

**Concrete steps:**
1. `git merge-tree` preview for each branch in order
2. Merge 037 → build → validate → tag `post-merge-037`
3. Merge 041 → build → validate → tag (expect nav conflicts with March 6 overhaul)
4. Merge 036 → build → validate
5. Decision point on 038: audit `--name-only`, discard if mostly test files
6. Merge 035, 039, 040 → build → validate → regenerate Drizzle migration after each schema-touching merge
7. Defer 031, 032, 034 to post-alpha unless they merge cleanly
8. Final: `bun run build` clean, `drizzle-kit check` passes, no TypeScript errors

### Phase 2: Docker Hardening

**Rationale:** The container must be proven locally before committing to a Vercel deployment. Docker provides the fastest feedback loop for build correctness. The existing Dockerfile is 90% correct but has four known defects that will cause production failures.

**Delivers:** A `docker compose up` experience that works from a clean clone — Postgres starts, schema migrates automatically, app starts, healthcheck returns 200, AI features don't silently fail.

**Uses:** `node:22-slim` runner, `postgres:17-alpine`, `sharp` in runner stage, `ENV CLAUDECODE=""` in Dockerfile

**Avoids pitfalls:** CLAUDECODE env leak (Pitfall 2), standalone missing deps (Pitfall 4), Redis healthcheck naming split (Pitfall 7)

**Research flag:** Migration entrypoint pattern (init service vs. entrypoint script) needs functional testing in the Bun monorepo Docker context — the docs support both approaches but the specific `bunx drizzle-kit push` in a Docker context with workspace symlinks is less documented.

**Concrete steps:**
1. Upgrade Dockerfile runner from `node:20-slim` to `node:22-slim`
2. Add `RUN npm install --cpu=x64 --os=linux --libc=glibc sharp@0.34` in runner stage
3. Add `ENV CLAUDECODE=""` in runner stage
4. Add `.auto-claude`, `.auto-claude/**` to `.dockerignore`
5. Add auto-migration init service to `docker-compose.yml` (runs `drizzle-kit push` after postgres healthy)
6. Upgrade local Postgres from 16 to 17 in all compose files
7. Fix Redis healthcheck in `healthcheck/route.ts` to check both `UPSTASH_REDIS_URL` and `REDIS_URL`
8. Validate: `docker compose up` from clean clone, hit `/api/healthcheck`, verify 200

### Phase 3: Vercel + Neon Deployment

**Rationale:** The same standalone build output proven in Docker phase deploys to Vercel with driver-level changes handled automatically by `db-adapter.ts`. Neon-Vercel integration provides the hardest part (preview branch automation) out of the box.

**Delivers:** Production deployment at a real URL with automatic preview environments per PR, schema migrations wired into the build command, and all required environment variables documented and configured.

**Uses:** Neon Managed Vercel Integration, pooled vs. unpooled connection strings, `DATABASE_URL_UNPOOLED` for migrations, Vercel Pro plan (required for 300s function duration and 5-minute cron schedule)

**Avoids pitfalls:** Neon pooled URL used for migrations (Pitfall 14), Vercel root directory misconfiguration (Pitfall 5), function duration Hobby plan limit (Pitfall 15), placeholder secrets passing startup silently (Pitfall 11), neon-http transaction semantics (Pitfall 3)

**Research flag:** Neon-http `db.transaction()` audit is required before this phase completes — it cannot be deferred. Also need to verify `NEXT_PUBLIC_APP_URL` handling for preview URLs (may need `VERCEL_URL` fallback).

**Concrete steps:**
1. Set Vercel project Root Directory to repo root (not `apps/dashboard`)
2. Diff all 10 worktree `vercel.json` files against main — reconcile any differences
3. Install Neon Managed Vercel Integration from Vercel Marketplace
4. Configure Neon branch hierarchy: main (scale-to-zero OFF, 1-4 CU autoscaling), dev branch, preview branches per PR
5. Set Vercel build command: `cd packages/db && bunx drizzle-kit push --url=$DATABASE_URL_UNPOOLED && cd ../.. && turbo build --filter=@sessionforge/dashboard`
6. Configure all required env vars per the table in STACK.md
7. Add startup validation: throw if `DATABASE_URL` is placeholder when `NODE_ENV=production`
8. Audit all `db.transaction()` calls for neon-http compatibility
9. Deploy and validate via `/api/deployment/validate` endpoint
10. Confirm `CRON_SECRET` is set and `/api/cron/automation` is protected

### Phase 4: CI Pipeline Consolidation

**Rationale:** CI automates verification of everything proven manually in Phases 1–3. The existing workflows are structurally correct but have inconsistencies that cause false positives. The missing container smoke test means CI currently passes when the container is broken.

**Delivers:** A CI pipeline where a green merge to main means the Docker image actually starts and responds, the Vercel preview environment has its own Neon branch, and schema drift is detected before any deployment proceeds.

**Uses:** `oven-sh/setup-bun@v2`, `actions/cache@v4` for `~/.bun/install/cache`, `docker/build-push-action@v6` with GHA cache backend, `TURBO_TOKEN`/`TURBO_TEAM` for remote cache

**Avoids pitfalls:** CI missing build env vars (Pitfall 8), no Turbo remote cache (Pitfall 10), container not actually smoke-tested (missing from current CI)

**Research flag:** No additional research needed. All patterns are well-documented GitHub Actions patterns.

**Concrete steps:**
1. Pin `oven-sh/setup-bun@v2` with `bun-version: "1.2.4"` in all workflows (fix `e2e.yml` which uses `@v1`)
2. Add `actions/cache@v4` for `~/.bun/install/cache` keyed on `bun.lock` hash
3. Remove duplicate lint job from `test.yml` (already in `ci.yml`)
4. Add `DATABASE_URL: "postgresql://test:test@localhost:5432/test"` as build-time env in CI
5. Add container smoke test job: compose up, sleep 10, `curl -f /api/healthcheck`, compose down
6. Add `TURBO_TOKEN` and `TURBO_TEAM` GitHub Actions secrets (or enable Vercel Remote Cache)
7. Add `preview.yml`: on PR open/sync, create Neon branch, deploy Vercel preview
8. Update `deploy.yml`: on push to main, after CI passes, `vercel deploy --prod`

### Phase 5: Feature Validation

**Rationale:** Alpha credibility requires proving the 50+ existing features work, not just that the build passes. Each deployment target (Docker and Vercel) must be validated independently.

**Delivers:** Evidence-backed alpha release — every core feature validated through the browser UI, post-editing controls verified end-to-end, edit history restore confirmed, and documentation audited for accuracy.

**Avoids pitfalls:** neon-http transaction failures that only manifest in production (Pitfall 3), decodeProjectPath lossy encoding in Docker (Pitfall 6)

**Research flag:** No research needed. Validation is functional, not research-dependent.

**Concrete steps:**
1. Validate in Docker: session ingestion, AI content generation (all 6 agents), Lexical editor, post-editing controls, revision history restore
2. Validate in Vercel: same features against production, watch for neon-http transaction failures
3. Validate post-editing wiring: confirm `inline-edit-controls.tsx` is connected to the editor page and AI chat responds
4. Audit all 16 docs in `docs/` for accuracy against current codebase
5. Test `docker compose up` from a clean clone on a machine without local env files
6. Tag `v0.1.0-alpha` after all validations pass

### Phase Ordering Rationale

- **Convergence first** because containerizing or deploying divergent code is strictly wasted work — each worktree produces a different build artifact
- **Docker before Vercel** because the same standalone output is validated locally before committing to production; Docker gives faster iteration without cloud account setup
- **Neon/Vercel concurrent with CI** — these are largely independent and could overlap, but sequential is safer to avoid deploying before CI gates are in place
- **Validation last** because it requires both deployment targets to be working

### Research Flags

**Needs deeper research during planning:**
- Phase 2 (Docker): `drizzle-kit push` in Docker context with Bun workspace symlinks — the init service entrypoint pattern needs functional testing, not just docs review
- Phase 3 (Vercel): `db.transaction()` audit for neon-http compatibility — requires reading every transaction call site in the codebase
- Phase 3 (Vercel): `NEXT_PUBLIC_APP_URL` vs. `VERCEL_URL` for preview deployments — needs verification against live Vercel behavior

**Standard patterns (skip research-phase):**
- Phase 1 (Convergence): Git merge protocol is mechanical; conflict resolution is manual judgment, not technical research
- Phase 4 (CI): All GitHub Actions patterns are well-documented; no novel integrations
- Phase 5 (Validation): Functional validation through browser UI; no technical research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Docker images verified on Docker Hub against lockfile; Neon docs verified for pooling and driver selection; no new packages needed |
| Features | HIGH | Post-editing controls, revision system, and diff viewers verified in codebase directly; worktree merge risk is LOW because conflict analysis requires running actual git diffs |
| Architecture | HIGH | Dual-driver pattern verified in `db-adapter.ts`; single-container pattern is well-established for Next.js standalone; Neon branching docs are official |
| Pitfalls | HIGH | 6 critical pitfalls identified from direct codebase inspection (schema.ts line counts, worktree diffs, Dockerfile contents); not inferred |

**Overall confidence:** HIGH

### Gaps to Address

- **Worktree merge conflict severity** — cannot assess actual conflict complexity without running `git merge-tree` for each branch. PITFALLS.md provides conflict hotspot analysis but the real merge difficulty is unknown until attempted. Plan for 1-2 days per schema-modifying branch.
- **neon-http transaction audit scope** — the number of `db.transaction()` call sites requiring remediation is unknown. If several core features depend on multi-table atomicity, remediation may require switching to the WebSocket driver or Neon's pooled TCP connection, which adds complexity to Phase 3.
- **Vercel build command migration timing** — the `drizzle-kit push` in the build command must complete before `turbo build` starts. With 30 tables, this may add 30-60 seconds to every Vercel build. Not a blocker but needs measurement.
- **decodeProjectPath in Docker** — the known CRITICAL bug (lossy encoding via filesystem heuristic) will break session scanning inside containers. For alpha, acceptable to document as "session scanning requires local `bun run dev`" but must be tracked.

## Sources

### Primary (HIGH confidence)
- [Neon Connection Pooling](https://neon.com/docs/connect/connection-pooling) — pooled vs direct connection strings, PgBouncer transaction mode
- [Neon Managed Vercel Integration](https://neon.com/docs/guides/neon-managed-vercel-integration) — preview branch setup, env var injection
- [Neon + Drizzle Guide](https://neon.com/guides/drizzle-local-vercel) — dual-driver pattern for local/production
- [Next.js Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying) — standalone output, Docker patterns
- [Vercel Monorepos](https://vercel.com/docs/monorepos) — root directory, build skipping, Bun workspace support
- [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) — GitHub Action v2, version detection from packageManager field
- [Drizzle Migration Conflicts](https://github.com/drizzle-team/drizzle-orm/discussions/1104) — journal.json linear history requirement
- Direct codebase inspection: `packages/db/src/schema.ts`, `Dockerfile`, `docker-compose*.yml`, `vercel.json`, `.github/workflows/`, `db-adapter.ts`, `inline-edit-controls.tsx`, `revision-history-panel.tsx`, `revisions/manager.ts`

### Secondary (MEDIUM confidence)
- [Shape of AI — Restructure Patterns](https://www.shapeof.ai/patterns/restructure) — post-editing UX patterns
- [Next.js Graceful Shutdown Issue #38298](https://github.com/vercel/next.js/issues/38298) — standalone shutdown broken (basis for anti-feature decision)
- [GetApp AI Writing Revision History Survey](https://www.getapp.com/all-software/ai-writing-assistant/f/revision-management/) — 83% user importance rating
- [Docker Build Cache in GitHub Actions](https://docs.docker.com/build/ci/github-actions/cache/) — BuildKit GHA cache backend

### Tertiary (LOW confidence — needs validation in implementation)
- `drizzle-kit push` timing in Vercel build command with 30 tables — estimated 30-60s, not measured
- Neon preview branch creation time with large schemas — not benchmarked

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
