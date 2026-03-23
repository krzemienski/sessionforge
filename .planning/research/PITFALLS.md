# Domain Pitfalls

**Domain:** Worktree convergence, Next.js containerization, and Vercel+Neon deployment for a Bun monorepo
**Project:** SessionForge v0.1.0-alpha
**Researched:** 2026-03-22

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken deployments.

---

### Pitfall 1: Drizzle Schema Merge Conflicts Across 3 Worktrees

**What goes wrong:** Three worktrees (031, 034, 040) all modify `packages/db/src/schema.ts` independently. Branch 031 adds `experimentStatusEnum`, `experimentKpiEnum`, and the `experiments` table (2880 lines). Branch 034 adds columns to `writingStyleProfiles` (2909 lines). Branch 040 adds `"doc_page"` to `contentTypeEnum` (2521 lines). Main is at 2902 lines after previous merges. Merging these sequentially will produce textual conflicts in the shared schema file -- and more dangerously, Drizzle's `journal.json` and `snapshot.json` files require a linear migration history that parallel branches break.

**Why it happens:** Each worktree was branched from an older commit (7 worktrees still base on the 2520-line version of schema.ts). They each generated their own migration snapshots independently. Drizzle has no built-in support for merging parallel migration histories -- the journal and snapshot files will conflict, and hand-editing them is error-prone.

**Consequences:**
- `drizzle-kit push` or `drizzle-kit migrate` will fail or produce incorrect DDL if snapshots are inconsistent
- pgEnum additions (031 adds 2 new enums, 040 modifies an existing enum) are position-sensitive in Postgres -- adding a value to an enum in the wrong transaction order can fail
- Silent schema drift between what Drizzle thinks the DB looks like (snapshot) and what it actually looks like

**Prevention:**
1. Merge schema-modifying branches first (040 first -- smallest change, then 034, then 031 last -- largest addition)
2. After each schema-modifying merge, delete all migration files from the branch and regenerate from scratch against the current schema: `bunx drizzle-kit generate` then `bunx drizzle-kit push`
3. After all 3 are merged, run `drizzle-kit push` against a fresh local Postgres to verify the final schema matches
4. Do NOT rely on Drizzle's migration journal from any branch -- regenerate the migration history from the converged schema

**Detection:** Run `drizzle-kit check` after each merge. If it reports snapshot inconsistencies, the journal needs regeneration. Also diff `packages/db/src/schema.ts` line count before/after each merge.

**Phase:** Worktree convergence (Phase 1) -- address before any deployment work begins.

---

### Pitfall 2: CLAUDECODE Env Var Leaks Into Docker Container and Vercel Functions

**What goes wrong:** The `CLAUDECODE` environment variable is inherited from the parent Claude Code session. In dev, `delete process.env.CLAUDECODE` is called at module-load time in 13 files before any `query()` call. But in Docker containers and Vercel serverless functions, the env var might be set if the build or deployment process runs inside a Claude Code session. If the container is built while Claude Code is running, the env var could be baked into the build layer. In Vercel, the env var could leak through the Vercel CLI if deployed from a Claude Code terminal.

**Why it happens:** The `delete process.env.CLAUDECODE` lines are a runtime fix, not a build-time fix. The Dockerfile's `ENV` declarations do not explicitly unset CLAUDECODE. The `vercel deploy` command inherits the shell environment.

**Consequences:**
- All 6 AI agents fail silently (exit code 1 from nested session rejection)
- No error message surfaces to the user -- the agent call just returns nothing
- In production, this manifests as "AI features don't work" with zero logs

**Prevention:**
1. Add `ENV CLAUDECODE=""` in the Dockerfile runner stage to explicitly clear it
2. Add `CLAUDECODE=""` to `docker-compose.yml` and `docker-compose.prod.yml` environment sections
3. In Vercel, verify CLAUDECODE is not in the project's environment variables dashboard
4. Add a CI check: `grep -r "CLAUDECODE" .env* vercel.json` should return nothing
5. Consider centralizing all `query()` calls through `agent-runner.ts` so only ONE file needs the deletion

**Detection:** After deployment, call any AI agent endpoint and check for empty/null responses. Add logging to `agent-runner.ts`: `if (process.env.CLAUDECODE) console.warn("CLAUDECODE env var present -- AI calls will fail")`

**Phase:** Containerization (Phase 2) and Deployment (Phase 3) -- must be addressed in both.

---

### Pitfall 3: Neon Serverless Driver vs. Local Postgres Driver Mismatch

**What goes wrong:** `db-adapter.ts` auto-detects the driver by checking if `DATABASE_URL` contains `neon.tech`. This works in production (Neon URL) and local Docker (standard Postgres URL). BUT the `neon-http` driver and the `postgres-js` driver have different behavior:
- `neon-http` executes each query as an independent HTTP request -- no persistent connections, no transactions spanning multiple queries
- `postgres-js` uses persistent TCP connections with full transaction support
- The code casts `pgDrizzle()` to `NeonHttpDatabase` with `as unknown as` -- a type lie that hides API differences

**Why it happens:** The dual-driver architecture was designed for flexibility but the type cast (`as unknown as NeonHttpDatabase`) suppresses TypeScript's ability to catch API mismatches. Code that works locally with `postgres-js` (e.g., multi-statement transactions) may silently break on Neon's HTTP driver.

**Consequences:**
- Features validated locally in Docker pass but fail in Vercel production
- Transaction-dependent operations (batch processing, multi-table writes) may produce partial writes on Neon
- Debugging is extremely difficult because the failure mode differs between environments

**Prevention:**
1. Audit all `db.transaction()` calls -- verify they work with Neon HTTP semantics (each statement is independent)
2. For operations requiring true transactions, use the WebSocket driver (`neon-websockets`) instead of `neon-http`, or use Neon's pooled connection with `postgres-js`
3. Add a startup check: log which driver was selected so deployment logs show "Using neon-http driver" or "Using postgres-js driver"
4. Test critical paths against the actual Neon database, not just local Postgres

**Detection:** Search for `db.transaction(` calls and verify each one works with HTTP-based execution. If any transaction does multi-table writes and expects atomicity, it will fail on neon-http.

**Phase:** Deployment validation (Phase 3) -- must be tested against real Neon, not just local Docker.

---

### Pitfall 4: Standalone Output Missing Dependencies in Monorepo Docker Build

**What goes wrong:** The current Dockerfile copies the entire repo (`COPY . .`) into the builder stage, then copies `.next/standalone` to the runner. In a monorepo with Bun workspaces, Next.js standalone output traces dependencies from `node_modules` but may miss:
- The `@sessionforge/db` package (internal workspace package) if it is not properly traced
- The `ssh2` native module (listed in `serverExternalPackages`) which needs special handling
- The `sharp` image optimization library which standalone mode requires but does not auto-bundle

**Why it happens:** Next.js standalone output uses `@vercel/nft` (Node File Tracing) to determine which files to include. Workspace packages symlinked by Bun may not be followed correctly. Native modules (`ssh2`, `sharp`) are platform-dependent and the build-stage architecture must match the runner-stage architecture.

**Consequences:**
- Container starts but crashes on first request touching DB operations (missing `@sessionforge/db`)
- SSH scan source features crash with "Cannot find module 'ssh2'"
- Image optimization returns 500 errors (missing `sharp`)
- All these work fine in `bun run dev` locally, making the bug hard to catch

**Prevention:**
1. Verify `@sessionforge/db` appears in `.next/standalone/node_modules/@sessionforge/` after build
2. Add `sharp` to the dashboard's `package.json` dependencies explicitly
3. In `next.config.ts`, add `outputFileTracingIncludes` for any native modules:
   ```ts
   experimental: {
     outputFileTracingIncludes: {
       '/**': ['./node_modules/sharp/**/*']
     }
   }
   ```
4. After building, run `node apps/dashboard/server.js` in the builder stage as a smoke test before copying to runner
5. The runner uses `node:20-slim` (correct -- glibc, not Alpine musl) which is good for native module compatibility

**Detection:** Build the container and run `docker exec <id> ls node_modules/@sessionforge/db` -- if it is empty or missing, the trace failed. Also: `docker exec <id> node -e "require('sharp')"`.

**Phase:** Containerization (Phase 2).

---

### Pitfall 5: Vercel Monorepo Build Command and Root Directory Confusion

**What goes wrong:** The current `vercel.json` sets `buildCommand: "cd apps/dashboard && bun run build"` and `outputDirectory: "apps/dashboard/.next"`. This works but has a subtle issue: Vercel's `installCommand: "bun install"` runs from the detected root directory. If Vercel's "Root Directory" setting in the project dashboard is set to `apps/dashboard` instead of the repo root, `bun install` will fail because it cannot find the workspace root's `bun.lock`, and the `buildCommand` will try to `cd` into a path that does not exist relative to the root directory.

**Why it happens:** Vercel has two competing configuration surfaces: the `vercel.json` file and the project dashboard settings. If someone configures the "Root Directory" in the Vercel dashboard to `apps/dashboard` (a common monorepo pattern), all paths in `vercel.json` become relative to that directory, breaking the build.

**Consequences:**
- Build fails with "bun.lock not found" or "directory apps/dashboard not found"
- Each worktree has its own `vercel.json` (confirmed: all 10 worktrees have copies) -- if any worktree's version differs, the merged result may have incorrect paths
- `maxDuration: 300` (5 minutes) requires Vercel Pro plan -- Hobby plan caps at 60 seconds

**Prevention:**
1. Set Vercel project Root Directory to repo root (NOT `apps/dashboard`)
2. Verify `vercel.json` is identical across all worktrees before merging -- run `diff` on each worktree's copy against main
3. Document that `maxDuration: 300` requires Pro plan in deployment docs
4. Pin `installCommand` to `bun install --frozen-lockfile` for reproducibility
5. The `crons` section schedules `/api/cron/automation` every 5 minutes -- this also requires Vercel Pro (Hobby allows max 2 daily crons)

**Detection:** Run `vercel build` locally before deploying. Check Vercel dashboard Root Directory setting matches expectations. Diff all worktree `vercel.json` files against main.

**Phase:** Deployment (Phase 3).

---

### Pitfall 6: decodeProjectPath Lossy Encoding Breaks in Docker (No Filesystem Access)

**What goes wrong:** `decodeProjectPath()` uses `fsSync.existsSync()` and `fsSync.statSync()` to disambiguate between `/` and `-` in encoded paths. In a Docker container, the user's project directories do not exist on disk -- the filesystem heuristic always fails, and the function falls back to treating every `-` as `/`, producing wrong paths like `/Users/nick/my/project` instead of `/Users/nick/my-project`.

**Why it happens:** The function was designed for local-only use where the developer's filesystem is available. In Docker or Vercel serverless, the scanner runs in an isolated environment without access to the original developer's machine.

**Consequences:**
- Session scanning misattributes sessions to wrong projects
- Dashboard shows garbled project names
- Any session whose project path contains a hyphen is displayed incorrectly
- This is already documented as a CRITICAL known bug but containerization makes it worse

**Prevention:**
1. Fix the encoding before containerizing: use a non-ambiguous encoding (base64url, or use `__` as separator instead of `-`)
2. At minimum, store the decoded project path alongside the encoded one at ingestion time so the container does not need to re-decode
3. If the fix is deferred, add prominent documentation that session scanning must happen on the local machine (not inside Docker)
4. Add a runtime warning when `fsSync.existsSync()` fails for all candidate paths

**Detection:** Import a session with a hyphenated project path in the Docker container. If the project name shows incorrect segments, the bug is active.

**Phase:** Must be fixed before containerization (Phase 1 or Phase 2). Deferring to post-alpha is acceptable only if session scanning is explicitly disabled in Docker.

---

## Moderate Pitfalls

### Pitfall 7: Redis Env Var Naming Split Between Deployment Modes

**What goes wrong:** Three different Redis connection patterns exist:
- `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` (Vercel production, `.env`, `docker-compose.prod.yml`)
- `REDIS_URL` (self-hosted Docker, `docker-compose.self-hosted.yml`)
- Neither set (local dev with placeholders)

The `redis.ts` client correctly handles all three cases (Upstash REST, ioredis, or null). But `healthcheck/route.ts` only checks `UPSTASH_REDIS_URL` to report Redis status -- it will report "not configured" even when `REDIS_URL` is set and ioredis is working.

**Prevention:**
1. Update the healthcheck to check both `UPSTASH_REDIS_URL` and `REDIS_URL`
2. Standardize env var documentation: one table showing which vars are needed per deployment mode
3. Verify docker-compose.yml (dev mode) does NOT set Redis vars since it has no Redis service

**Detection:** Run healthcheck in self-hosted Docker mode -- it will incorrectly report Redis as unconfigured.

**Phase:** Containerization (Phase 2).

---

### Pitfall 8: GitHub Actions CI Missing Build Env Vars

**What goes wrong:** The `test.yml` workflow runs `bun run build` in the e2e job with `NODE_ENV: production` but does not set `DATABASE_URL` or other required env vars. The build will fail if any route file imports `db-adapter.ts` at build time (which it does via server components).

The `e2e.yml` workflow sets `DATABASE_URL` from secrets but uses `oven-sh/setup-bun@v1` (not `v2`) -- version 1 has known caching issues. It also does not start a local database or app server before running Playwright tests.

**Prevention:**
1. Add `DATABASE_URL: "postgresql://test:test@localhost:5432/test"` as a build-time env var in CI (the build only needs it to pass module resolution, not actual connectivity)
2. Update `oven-sh/setup-bun@v1` to `v2` in `e2e.yml`
3. Add a `services:` section with Postgres in CI for integration tests, or use a Neon branch
4. The e2e workflow needs a step to start the built app before running Playwright

**Detection:** Push to a PR branch and check if CI builds fail. The current workflows may already be failing silently.

**Phase:** CI setup (Phase 2 or Phase 3).

---

### Pitfall 9: 10 Worktrees Based on Stale Main (382+ Lines Behind in Schema)

**What goes wrong:** 7 out of 10 worktrees (032, 035, 036, 037, 038, 039, 041) have schema.ts at 2520 lines while main is at 2902 lines. These branches were created before specs 022-030 were merged. When merging, every branch will have conflicts in the schema file, `package.json` (dependency versions), and potentially in shared UI components that were refactored during the codebase overhaul (2026-03-06).

**Why it happens:** The worktrees were created from an older main commit and never rebased. The 382-line gap represents 8+ previous merges worth of schema additions.

**Consequences:**
- Every merge will require resolving conflicts in `schema.ts` even for branches that do not touch the schema
- Package lock drift: Bun workspace resolution may produce different `bun.lock` content after each merge
- UI components refactored in the March 6 overhaul (content page decomposition, nav consolidation) will conflict with branches that modified the same files

**Prevention:**
1. Merge non-schema-modifying branches first (easier conflicts)
2. Suggested merge order by conflict risk (lowest first):
   - 032 (8 files, no schema changes, new pages only)
   - 038 (28 files but mostly test files, no schema -- but tests violate project mandate, may need to discard)
   - 039 (13 files, no schema, adds structured data)
   - 035 (7 files, no schema, content versioning UI)
   - 036 (6 files, no schema, filtering UI)
   - 037 (34 files, no schema, a11y fixes + CI change)
   - 041 (19 files, no schema, mobile responsive -- conflicts with March 6 overhaul)
   - 040 (29 files, schema: adds enum value, new engine)
   - 034 (18 files, schema: adds columns to existing table)
   - 031 (15 files, schema: adds 2 enums + full table, largest change)
3. After each merge, run `bun install --frozen-lockfile` to catch lock drift early
4. Build after every merge: `bun run build` must pass before the next merge begins

**Detection:** Before merging, run `git merge-tree $(git merge-base main auto-claude/<branch>) main auto-claude/<branch>` to preview conflicts without modifying the working tree.

**Phase:** Worktree convergence (Phase 1).

---

### Pitfall 10: Turbopack Disabled But Turbo Remote Cache Not Configured

**What goes wrong:** The project uses `next dev` (NOT `--turbopack`) due to drizzle-orm relation bugs. But `turbo.json` is configured for Turborepo build orchestration. In CI, `bun run build` goes through Turbo, but there is no remote cache configured (`TURBO_TOKEN`, `TURBO_TEAM`). Every CI run rebuilds from scratch. For a 30-table, 76-route app, this means 3-5 minute builds on every PR.

**Prevention:**
1. Add `TURBO_TOKEN` and `TURBO_TEAM` to GitHub Actions secrets
2. Add to CI workflow: `env: TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}`
3. Alternatively, if Vercel is the deployment target, Vercel provides free Remote Cache for Turborepo -- enable it in the Vercel dashboard
4. Do NOT enable `--turbopack` for dev or build -- the drizzle-orm relation bug is still present in Next.js 15.1

**Detection:** Check CI build times. If consistently over 3 minutes, remote cache is likely not configured.

**Phase:** CI setup (Phase 3).

---

### Pitfall 11: Placeholder Secrets Pass Startup But Fail at Runtime

**What goes wrong:** Multiple services use placeholder fallbacks that allow the app to start but fail at runtime:
- `STRIPE_SECRET_KEY` falls back to `"placeholder-stripe-secret-key"` -- Stripe API calls fail with cryptic errors
- `DATABASE_URL` falls back to `"postgresql://user:pass@localhost:5432/placeholder"` -- all queries fail
- `UPSTASH_REDIS_URL` is set to `"placeholder"` in `.env` and `.env.local` -- Redis operations silently degrade
- `BETTER_AUTH_SECRET` defaults to `"dev-secret-change-in-production"` in docker-compose.yml -- auth works but is insecure

**Consequences:**
- App starts successfully, healthcheck passes, container is "healthy" -- but features fail one by one as users interact
- In production, Stripe webhook verification fails silently, billing is broken
- Session hijacking risk if `BETTER_AUTH_SECRET` is not changed from the dev default

**Prevention:**
1. Add startup validation: throw if required secrets are placeholders in production (`NODE_ENV=production`)
2. The deployment validation endpoint (`/api/deployment/validate`) already checks for these -- make it part of the container healthcheck
3. In Vercel, use Environment Variable groups and mark required vars as mandatory
4. Never commit `.env` with placeholder values to git (current `.env` IS committed with placeholders)

**Detection:** Hit `/api/deployment/validate` after deployment -- it reports which env vars are present/missing.

**Phase:** Deployment (Phase 3).

---

## Minor Pitfalls

### Pitfall 12: Docker Healthcheck Uses `node -e fetch()` But Container Might Not Have Node

**What goes wrong:** The Dockerfile healthcheck runs `node -e "fetch('http://localhost:3000/api/healthcheck')..."`. The runner stage uses `node:20-slim` so this works. But if someone switches the runner to `oven/bun` to match the build stage (a tempting "optimization"), the healthcheck will still work (Bun has `node` command compat) -- but `wget` in the self-hosted compose healthcheck (`wget -qO-`) requires `wget` to be installed, which is not present in all slim images.

**Prevention:** Use `curl` or `node -e` consistently. Verify the healthcheck command exists in the chosen base image.

**Phase:** Containerization (Phase 2).

---

### Pitfall 13: Branch 038 Contains 15,397 Lines of Test Code (Project Mandate Violation)

**What goes wrong:** Branch `038-comprehensive-test-coverage-expansion` adds 15,397 lines of insertions across 28 files. Given the project's strict "NEVER write test files, mocks, or stubs" mandate, this branch likely contains test files that should not be merged. Merging it blindly would violate the project philosophy and introduce maintenance burden.

**Prevention:**
1. Audit branch 038's changes: `git diff main...auto-claude/038-comprehensive-test-coverage-expansion --name-only`
2. If it contains `*.test.ts`, `*.spec.ts`, or `__tests__/` directories, decide whether to discard the branch entirely or cherry-pick only non-test changes
3. The branch's CI workflow changes (if any) may still be valuable even if the tests are discarded

**Detection:** Check file extensions in the diff. If predominantly `.test.ts` files, flag for review.

**Phase:** Worktree convergence (Phase 1) -- decide before merging.

---

### Pitfall 14: Neon Connection Pooling Requires Separate URLs for Migrations vs. Runtime

**What goes wrong:** Neon's PgBouncer pooler runs in transaction mode. Schema migrations (`drizzle-kit push`, `drizzle-kit migrate`) require a direct (non-pooled) connection because they use `SET` statements and DDL that PgBouncer does not support. If `DATABASE_URL` points to the pooled endpoint (`-pooler` in the hostname), migrations will fail or produce unpredictable results.

**Prevention:**
1. Use two env vars: `DATABASE_URL` (pooled, for runtime) and `DATABASE_URL_DIRECT` (direct, for migrations)
2. Update `drizzle.config.ts` to use `DATABASE_URL_DIRECT || DATABASE_URL`
3. In Neon dashboard, the pooled URL contains `-pooler` in the hostname -- verify which one is being used
4. Run migrations from a local machine or CI step using the direct URL, never from a serverless function

**Detection:** If `drizzle-kit push` hangs or errors with "prepared statement does not exist," you are hitting the pooler.

**Phase:** Deployment (Phase 3).

---

### Pitfall 15: Vercel Function Duration Limits vs. AI Agent Timeouts

**What goes wrong:** The `vercel.json` sets `maxDuration: 300` (5 minutes) for agent routes. However:
- Vercel Hobby plan caps at 60 seconds regardless of config
- Vercel Pro plan allows up to 300 seconds
- The `@anthropic-ai/claude-agent-sdk` `query()` calls can take 30-120 seconds depending on content length
- If the function times out mid-generation, the user sees a 504 with no partial result and no way to resume

**Prevention:**
1. Confirm Vercel plan supports 300s function duration
2. Add streaming responses for long-running agent calls so partial results are delivered
3. Consider background processing with QStash for agent calls instead of synchronous Vercel functions
4. The `DISABLE_AI_AGENTS: "true"` default in docker-compose is a good safeguard -- document when/how to enable it

**Detection:** Trigger a content generation via the UI and monitor Vercel function logs for timeout errors.

**Phase:** Deployment (Phase 3).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Worktree convergence | Schema merge conflicts in 3 branches (031, 034, 040) | Merge in order: non-schema first, schema branches last, regenerate migrations after each |
| Worktree convergence | 038 branch violates no-test-files mandate | Audit and selectively discard test files before merge |
| Worktree convergence | 041 mobile branch conflicts with March 6 UI overhaul | Expect conflicts in nav components, content page, sidebar -- resolve manually |
| Worktree convergence | All 7 stale branches will conflict in schema.ts | Accept "theirs" for schema.ts (main's version), then cherry-pick additions |
| Containerization | CLAUDECODE env var not explicitly cleared in Docker | Add `ENV CLAUDECODE=""` to Dockerfile |
| Containerization | standalone output missing workspace packages | Verify `@sessionforge/db` in `.next/standalone/node_modules/` |
| Containerization | sharp not bundled in standalone | Add sharp dependency and `outputFileTracingIncludes` |
| Containerization | Redis env var naming differs between compose files | Standardize healthcheck to check both `UPSTASH_REDIS_URL` and `REDIS_URL` |
| Deployment (Vercel) | Root directory misconfiguration | Set to repo root, not `apps/dashboard` |
| Deployment (Vercel) | Function duration requires Pro plan | Verify plan or reduce `maxDuration` |
| Deployment (Vercel) | Cron job requires Pro plan (5-min schedule) | Downgrade to daily or confirm Pro plan |
| Deployment (Neon) | Pooled vs. direct URL for migrations | Use separate `DATABASE_URL_DIRECT` for drizzle-kit |
| Deployment (Neon) | neon-http driver lacks true transactions | Audit all `db.transaction()` usage paths |
| CI setup | e2e workflow missing app server startup | Add build+start step before Playwright |
| CI setup | No Turbo remote cache configured | Add `TURBO_TOKEN`/`TURBO_TEAM` secrets |
| CI setup | Build env vars missing `DATABASE_URL` | Add dummy URL for build-time module resolution |
| Local dev parity | decodeProjectPath fails without filesystem | Fix encoding or store decoded paths at ingestion |
| Local dev parity | Placeholder secrets pass startup silently | Add production-mode validation at startup |

## Sources

- Drizzle multi-branch migration conflicts: [GitHub Discussion #1104](https://github.com/drizzle-team/drizzle-orm/discussions/1104), [Issue #1221](https://github.com/drizzle-team/drizzle-orm/issues/1221), [Issue #2488](https://github.com/drizzle-team/drizzle-orm/issues/2488)
- Next.js standalone Docker: [Vercel official example](https://github.com/vercel/next.js/tree/canary/examples/with-docker), [Next.js output docs](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)
- Next.js standalone missing assets: [Issue #49283](https://github.com/vercel/next.js/issues/49283), [Sharp in standalone](https://nextjs.org/docs/messages/sharp-missing-in-production)
- Neon connection methods: [Neon docs](https://neon.com/docs/guides/vercel-connection-methods), [Connection pooling docs](https://neon.com/docs/connect/connection-pooling)
- Neon + Drizzle local dev: [Neon guide](https://neon.com/guides/drizzle-local-vercel), [Drizzle with Neon tutorial](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)
- Bun CI caching: [setup-bun caching issue](https://github.com/oven-sh/setup-bun/issues/78), [Bun cache discussion](https://github.com/oven-sh/bun/discussions/18752)
- Vercel monorepo config: [Vercel monorepo docs](https://vercel.com/docs/monorepos), [Monorepo FAQ](https://vercel.com/docs/monorepos/monorepo-faq)
- Turborepo CI: [GitHub Actions guide](https://turborepo.dev/docs/guides/ci-vendors/github-actions)
- Codebase analysis: `packages/db/src/schema.ts`, `apps/dashboard/src/lib/db-adapter.ts`, `Dockerfile`, `docker-compose*.yml`, `vercel.json`, `.github/workflows/test.yml`, `.github/workflows/e2e.yml` (direct inspection)
- `.planning/codebase/CONCERNS.md` (project's own audit, 2026-03-22)

---

*Pitfalls audit: 2026-03-22*
