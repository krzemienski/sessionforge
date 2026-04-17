# ROADMAP — 8 Waves, 52 Findings

**Revision:** 2026-04-17 17:23 ET. Original 7-wave plan expanded to 8 waves after Wave 1 execution surfaced C7 (build-broken) and C8 (runtime NPE) + advisory M19. Wave 0 inserted as pre-requisite build-unblock.

**Sequencing rationale:** build must pass before any wave's validation gate can fire → Wave 0 precedes everything. Then deps before runtime before contract before structure. Each wave's gate exercises the touched surface AND re-runs prior wave smokes.

## Wave 0 — Build Unblock (NEW)

**Findings:** C7 (C8 reclassified NOT_A_BUG — see note below)
**Touches:** 2 bookmark route handlers (Next 15 context typing).
**Risk:** Low — localized type fixes.
**Why first:** Every other wave has a `bun run build exit 0` gate criterion. Currently fails.

**C8 reclassification (2026-04-17 17:40 ET):** Wave 0 executor verified that the portfolio RSS route (line 31) short-circuits all `portfolio.X` accesses via `const rssAllowed = !!portfolio && portfolio.isEnabled && portfolio.showRss`, and the only other reference (`portfolio?.bio` at line 85) uses optional chaining. Missing-workspace returns 404 at line 19. Returning an empty RSS feed (not 404) when portfolio is missing is an **intentional** design choice documented in the route comment, so feed readers don't choke. C8 was a false positive from the faulty Wave 1 SUMMARY.md.

**Phase Gate:**
- `bun run build` exit 0 in `apps/dashboard`.
- `tsc --noEmit` strict clean on the 2 touched files.

## Wave 1 — Dependency Hygiene (PARTIAL — RESUMED)

**Findings:** C1, C2✅, H5✅, H6, H7, ~~H8~~ (DEFERRED — requires drizzle 0.41 Relational Query v2 migration; tracked as a future wave), H14, M1, M2, M3, M4, M14✅, M17 (13 total)
**Status:** 3 CLOSED, 1 DEFERRED, 9 REMAINING.
**Touches:** `apps/dashboard/package.json` (C1, H6, M2, M3, H14), `next.config.ts` (H7, M17), syntax highlighter picks (M1), happy-dom resolution (M4 — likely auto-resolved when H6 removes happy-dom entirely).

**Phase Gate (updated from original):**
- `bun install` clean, no peer-dep errors.
- `bun run build` exit 0 (relies on Wave 0).
- `bun audit` — no NEW advisories vs Wave 0 baseline.
- `grep -r "anthropic-ai/sdk" apps/dashboard/.next/server/` → NOT_FOUND.
- `bun pm ls --all` inventory: `@anthropic-ai/sdk`, `zustand`, `@types/sharp`, `@types/jszip`, `vitest`, `msw`, `happy-dom`, `@playwright/test`, `@testing-library/*`, `@axe-core/playwright` ALL absent.
- Smoke: login → workspace → content list. 4 screenshots.

## Wave 2 — Critical Runtime

**Findings:** C3, C4, C5, C6, H11, H13 (6)
**Touches:** `api/cron/automation`, `lib/sessions/indexer.ts`, `agent-runner.ts`, `sessions/scan/stream`, `db-adapter.ts`, 16 files using `delete process.env.CLAUDECODE`.
**Risk:** High — hot-path changes.

**Phase Gate:**
- Boot with DATABASE_URL unset → fails at module load.
- Cron tick → pipeline completes past response return; DB row confirms `status='completed'` with `updated_at > created_at + 10s`.
- SSE agent run: disconnect mid-stream → `agent_runs.status='aborted'`; server log shows abort-signal firing.
- Session indexer: 50-session ingest → 1 SQL INSERT, not 50.
- `grep -rn "delete process.env.CLAUDECODE" apps/ packages/ | grep -v ensure-cli-auth.ts` → empty.
- Regression: Wave 0+1 smoke.

## Wave 3 — API Contract

**Findings:** H1, H2, H4, H15, M11 (5)
**Touches:** 9 `/api/v1/*` routes, up to 168 internal routes missing Zod, 3 OAuth callbacks, `db-adapter.ts` type cast, Stripe webhook.
**Risk:** Medium. May split into 03-02 / 03-03 if Zod backfill exceeds session budget.

**Phase Gate:**
- v1 malformed-body POST → correct `{data:null, meta, error:{message,code}}` envelope for all 9 routes.
- `grep -rL parseBody.*z\\.parse apps/dashboard/src/app/api --include route.ts` → only documented exceptions.
- Tampered OAuth state → structured AppError response.
- Stripe bad-signature webhook → `error.code='BAD_REQUEST'`.
- `grep "as unknown as" lib/db-adapter.ts` → empty.
- Regression: Wave 0–2.

## Wave 4 — Schema & Structure

**Findings:** H3, H12, M12, M13 (4)
**Touches:** `schema.ts` split into `schema/` directory, component→route import leak, `content-strategist` agent empty tool groups, `content` component `any[]` tightening.

**Phase Gate:**
- `drizzle-kit generate` → zero migration diff.
- `grep -r "@sessionforge/db" apps/ | wc -l` within ±2 of pre-wave baseline.
- `content-strategist` real run → SSE log shows tool calls from all wired groups.
- `grep -r "from ['\"]@/app/" apps/dashboard/src/components/` → empty.
- `tsc --noEmit --strict` zero errors.
- Regression: Wave 0–3.

## Wave 5 — Performance Polish

**Findings:** H9, H10, M5, M6, M7, M8, M9, M10, M15, M16 (10)
**Touches:** `feed/[...slug]` caching, Redis/postgres singletons, React Query hooks, `miner.ts`, SSE heartbeat, middleware matcher, findMany limits, ingestion streaming, batch content concurrency cap, recharts compat.

**Phase Gate:**
- 2nd feed request < 30% time of 1st + `Cache-Control` header present.
- SSE 60s run shows ping frames every ~15s (HAR export).
- `grep "new Redis(" apps/dashboard/src | grep -v lib/redis.ts` empty (same for `postgres(`).
- Static asset fetch does NOT invoke middleware.
- `grep "findMany" ... | grep -v "limit:"` → documented exceptions only.
- 10 concurrent SSE streams succeed, zero drops.
- Every charts-page renders with zero recharts console warnings.
- Regression: Wave 0–4.

## Wave 6 — Medium Cleanup & Audit

**Findings:** M18, M19 + all 10 LOW (12 total)
**Touches:** advisory response, doc drift, dead exports, LOW findings closure.

**Phase Gate:**
- `bun audit` CRITICAL=0, HIGH=0. Moderate advisories (M19 dompurify) documented in `audit-exceptions.md`.
- MEMORY.md + CLAUDE.md counts match grep reality.
- Zero unused exports or documented exceptions.
- 10/10 LOW findings closed with outcome: FIXED / SUPERSEDED / DEFERRED.
- Regression: Wave 0–5.

## Wave 7 — Final Full-System Regression

**Scope:** not new fixes — full functional validation across every subsystem.
**Touches:** 6 agents × 3 content types × 3 publishers × session scan × 4 webhooks × cron tick.

**THE RELEASE GATE:**
- 21/21 pages load with zero console errors (evidence: 21 screenshots + dumps).
- 6/6 agents produce real content in real workspace (DB rows captured).
- 3/3 publishers return platform URL + DB `published_at`.
- 4/4 webhooks + 1 cron observed end-to-end.
- `bun run build` zero errors, bundle delta recorded.
- `bun audit` CRIT/HIGH = 0.
- All 52 findings in `evidence/07-01/findings-matrix.csv` (id, severity, wave, commit, evidence_path).

## Finding → Wave Mapping (52 total)

| Finding | Wave | Status |
|---------|------|--------|
| C7, C8 | 0 | OPEN |
| C1, H6, H7, H14, M1, M2, M3, M4, M17 | 1 | OPEN |
| C2, H5, H8, M14 | 1 | ✅ COMMITTED |
| C3, C4, C5, C6, H11, H13 | 2 | OPEN |
| H1, H2, H4, H15, M11 | 3 | OPEN |
| H3, H12, M12, M13 | 4 | OPEN |
| H9, H10, M5, M6, M7, M8, M9, M10, M15, M16 | 5 | OPEN |
| M18, M19 + 10 LOW | 6 | OPEN |
| (regression only) | 7 | — |

**Totals:** 6 CRIT / 15 HIGH / 19 MED (original 18 + M19) / 10 LOW + 2 new CRIT (C7, C8) = **52**.

**Revised severity totals:** 8 CRIT / 15 HIGH / 19 MED / 10 LOW.
