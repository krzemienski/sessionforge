# BRIEF — Full-Codebase Review Remediation

**Project:** SessionForge v0.1.0-alpha remediation
**Created:** 2026-04-17 16:45 ET
**Revision:** 2026-04-17 17:23 ET — restored after first execution attempt; total findings now **52** (49 original + 3 surfaced during Wave 1 execution: C7, C8, M19).
**Source:** `/plans/reports/review-synthesis-260417-1645-full-monorepo.md` + 3 perspective reports + `phases/01-dependency-hygiene/SUMMARY.md` (partial execution log).

## Vision

Ship v0.1.0-alpha with every finding from the 2026-04-17 code review closed AND every touched subsystem functionally re-validated through the real running system. No regressions introduced. No mocks used. No test files authored.

## Platform

- Monorepo: bun 1.2.4 + Turbo 2. Workspaces: `apps/dashboard` (Next.js 15 / React 19), `packages/db` (Drizzle 0.39→0.41 bump committed), `packages/tsconfig`.
- 638 TS/TSX, 202 API routes, 21 pages, 6 AI agents, 30+ DB tables.
- Auth: better-auth (email + GitHub OAuth). AI: `@anthropic-ai/claude-agent-sdk` (CLI-inherited auth).
- Dev server: `next dev` (NOT turbopack — documented drizzle bug).

## Validation Strategy

Every wave ends with a **blocking functional validation gate** exercising every real component touched in that wave. Rules:

- **No mocks / stubs / test files.** Period.
- Every gate captures: screenshots (browser UI), API response bodies (curl or Playwright MCP), DB row counts, log excerpts, build output.
- Evidence stored in `phases/<wave>/evidence/` — non-empty, dated, greppable.
- Gate is PASS only when every listed criterion has cited evidence. Empty files = FAIL.
- Regression check from Wave 1 onwards: prior waves' PASS journeys re-executed.

## Current State (2026-04-17 17:23)

- **Committed closures:** 4 findings (C2, H5, H8, M14) across 2 commits (`2508a3e`, `f7b0a64`).
- **Working tree:** 3 modified files (`api-handler.ts`, `rss/route.ts`, `bun.lock`) — NOT reflecting the partial Wave 1 changes the subagent SUMMARY claimed to have made. Those changes did not persist.
- **Build status:** `bun run build` FAILS on main at 4 route-type errors + 1 undefined deref (new findings C7/C8).
- **Audit:** 1 moderate advisory (dompurify via mermaid — new finding M19).

## Out of Scope

- New features. Only fixes to findings from the 2026-04-17 review + the 3 surfaced during remediation.
- Refactors not tied to a finding.
- Unit tests / test files / mocks (project mandate).
- Production deployment. This is pre-merge remediation on main.

## Success Criteria

- All 52 findings marked CLOSED with cited fix commits + validation evidence.
- `bun run build` + `bun run lint` clean across every workspace.
- Smoke journey PASSes: login → workspace → ingest session → run blog writer agent → edit content → publish to dev.to → view in portfolio.
- No regression in any existing PASS journey from Wave 1.
- `bun audit` CRITICAL/HIGH count = 0. Moderate advisories documented.
- MEMORY.md updated to reflect corrected counts (202 routes, 16 CLAUDECODE files, 6 agents, 30 tables).
