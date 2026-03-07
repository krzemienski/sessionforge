# Phase 01 — E2E Bug Fixes

**Priority:** CRITICAL
**Status:** ✓ COMPLETED
**Effort:** Small (2-3 hours)
**Completed:** 2026-03-06

---

## Skills to Invoke

| Skill | When | Purpose |
|-------|------|---------|
| `/debug` | Before each fix | Root-cause analysis of insights_extracted=0 anomaly, health check logic |
| `/sequential-thinking` | Before implementing fixes | Break down each bug into discrete investigation steps |
| `/code-review` | After each fix | Review fix quality, check for regressions |
| `/gate-validation-discipline` | After ALL fixes complete | Evidence-based verification: cite specific DB values, build output, UI screenshots |

### Gate Validation Checklist (Phase 01)
- [x] **Evidence examined**: Query `automationRuns` table — `insightsExtracted` > 0 after pipeline run
- [x] **Evidence examined**: Read parser.ts — single shared `parseSessionLines()` function exists
- [x] **Evidence examined**: UI screenshot — dev status shows "healthy" (not "degraded")
- [x] **Evidence examined**: `bun run build` output — zero errors, exit code 0

---

## Context

The E2E validation (13/14 gates PASS) surfaced one anomaly and several minor issues that need fixing before the overhaul work begins.

## Issues to Fix

### 1. `insights_extracted` Counter Not Updating (ANOMALY from E2E)

**Evidence:** `e2e-evidence/pipeline-architecture/VALIDATION-REPORT.md` line 98 — automation run shows `insights_extracted=0` despite producing a 1,574-word blog post.

**Root Cause Investigation:**
- File: `src/lib/automation/pipeline.ts`
- The pipeline's EXTRACT stage calls `analyzeCorpus()` which returns `{ insightCount, text }`
- The `insightCount` may not be getting written back to the `automationRuns` record
- OR: corpus-analyzer creates insights via MCP tools but the count isn't captured in the return value

**Fix:**
1. Read `pipeline.ts` — trace where `insightsExtracted` is updated on the `automationRuns` record
2. Ensure `corpusResult.insightCount` is written to DB after extract stage
3. If the corpus-analyzer agent creates insights via `create_insight` tool calls, count those tool results

### 2. Session Parser Duplication

**Evidence:** Research found `parseSessionFile()` and `parseSessionBuffer()` share ~270 lines of duplicated logic.

**Fix:**
- Extract shared parsing logic into a private `parseSessionLines(lines: string[])` function
- Both public functions call the shared implementation
- File: `src/lib/sessions/parser.ts`

### 3. Verify Dev Server Status Indicator

**Evidence:** UI screenshots show "degraded" status (DB: ok, Redis: down) — this is expected in dev but should show "healthy" when Redis isn't configured rather than "degraded."

**Fix:**
- When Redis URL is not configured (dev mode), status should show "healthy" or omit Redis from checks
- File: Likely in a health check API route or status component

---

## Files to Modify

- `src/lib/automation/pipeline.ts` — Fix insights counter
- `src/lib/sessions/parser.ts` — Deduplicate parsing logic
- Health check route/component — Fix dev mode status

## Success Criteria

- [x] `automationRuns.insightsExtracted` correctly reflects actual insight count after pipeline run
- [x] Parser duplication reduced (single shared implementation)
- [x] Dev mode shows appropriate status (not "degraded" when Redis is intentionally absent)
- [x] Production build passes
