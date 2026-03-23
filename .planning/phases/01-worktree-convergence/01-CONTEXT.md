# Phase 1: Worktree Convergence - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit all 31 specs (001-041) for completeness on main, fix any gaps found in 001-030, then merge all 9 remaining worktrees (031-041, skip 038) into main with per-merge validation. Produce a unified codebase with clean build and regenerated Drizzle migrations.

</domain>

<decisions>
## Implementation Decisions

### Spec Audit Depth
- **D-01:** Full audit with build verification — read each spec's acceptance criteria, grep codebase for implementation, verify build compiles with features present
- **D-02:** Fix gaps before merging — if audit finds partially implemented or missing features from specs 001-030, fix them before proceeding to worktree merges

### Merge Scope
- **D-03:** Merge all 9 remaining branches (skip 038 only) — maximum feature coverage for alpha
- **D-04:** Merge order by risk tier: low-risk UI-only first (037→041→036), then schema-touching (035→031→034), then cross-cutting (039→040→032)
- **D-05:** Never skip a branch — if a branch has conflicts, keep working until it merges. No branch left behind
- **D-06:** Branch 038 (comprehensive test coverage) is explicitly skipped — 15,397 lines of test files violates the no-mock mandate

### Schema Conflict Strategy
- **D-07:** Regenerate Drizzle migrations after each schema-modifying merge — delete all migration files, run drizzle-kit generate + push after each merge
- **D-08:** Main-first schema merge strategy — accept main's schema.ts as base, cherry-pick only NEW tables/columns from the branch on top
- **D-09:** Each merge gets: merge → resolve conflicts → build → drizzle-kit generate → drizzle-kit push → validate → commit

### Claude's Discretion
- Exact conflict resolution strategy for each branch (semantic analysis of each conflict file)
- Build validation approach (full build vs typecheck-only between merges)
- Whether to create safety tags between merges (recommended but not mandated)
- How to handle the CLAUDECODE env var fix in merged branches (ensure all AI files retain the fix)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec Directories
- `.auto-claude/specs/001-remote-session-ingestion-via-upload-api/` — Session upload API spec
- `.auto-claude/specs/005-mobile-responsive-dashboard/` — Mobile responsive spec
- `.auto-claude/specs/006-comprehensive-test-suite-expansion/` — Test suite spec (reference only)
- `.auto-claude/specs/007-content-templates-library/` — Content templates spec
- `.auto-claude/specs/012-github-repository-deep-integration/` — GitHub integration spec
- `.auto-claude/specs/013-static-site-github-pages-export/` — Static site export spec
- `.auto-claude/specs/015-evidence-citations-source-linking/` — Evidence citations spec
- `.auto-claude/specs/016-ghost-cms-publishing-integration/` — Ghost CMS spec
- `.auto-claude/specs/017-ai-writing-coach-style-analytics/` — Writing coach spec
- `.auto-claude/specs/018-interactive-onboarding-guided-setup-wizard/` — Onboarding wizard spec
- `.auto-claude/specs/019-content-version-history-diff-comparison/` — Version history spec
- `.auto-claude/specs/020-smart-content-repurposing-engine/` — Repurposing engine spec
- `.auto-claude/specs/021-public-developer-portfolio-pages/` — Portfolio pages spec
- `.auto-claude/specs/022-end-to-end-pipeline-observability-dashboard/` — Observability spec
- `.auto-claude/specs/023-automated-integration-health-checks-self-healing-r/` — Health checks spec
- `.auto-claude/specs/024-factual-claim-verification-risk-flags/` — Claim verification spec
- `.auto-claude/specs/025-editorial-approval-workflows-draft-review-approved/` — Editorial workflows spec
- `.auto-claude/specs/026-research-workspace-source-notebook/` — Research workspace spec
- `.auto-claude/specs/027-role-based-access-control-rbac-and-workspace-permi/` — RBAC spec
- `.auto-claude/specs/028-full-fidelity-content-backup-migration-toolkit/` — Backup toolkit spec
- `.auto-claude/specs/029-self-hosted-byo-infrastructure-deployment-mode/` — Self-hosted spec
- `.auto-claude/specs/030-cross-platform-attribution-roi-dashboard/` — Attribution dashboard spec
- `.auto-claude/specs/031-a-b-headline-and-hook-experimentation/` — A/B headlines spec
- `.auto-claude/specs/032-compliance-billing-trust-center/` — Compliance billing spec
- `.auto-claude/specs/033-critical-bug-resolution-schema-stability/` — Bug resolution spec
- `.auto-claude/specs/034-voice-calibration-authentic-content-engine/` — Voice calibration spec
- `.auto-claude/specs/035-content-versioning-visual-diff-view/` — Content versioning spec
- `.auto-claude/specs/036-series-collection-advanced-filtering/` — Series filtering spec
- `.auto-claude/specs/037-wcag-accessibility-compliance/` — WCAG accessibility spec
- `.auto-claude/specs/038-comprehensive-test-coverage-expansion/` — Test coverage spec (SKIPPED)
- `.auto-claude/specs/039-structured-data-rich-snippet-optimization/` — Structured data spec
- `.auto-claude/specs/040-ai-content-repurposing-engine/` — AI repurposing spec
- `.auto-claude/specs/041-mobile-responsive-dashboard-experience/` — Mobile dashboard spec

### Research
- `.planning/research/PITFALLS.md` — Critical pitfalls including schema conflict analysis
- `.planning/research/ARCHITECTURE.md` — Merge order recommendations and container architecture
- `.planning/research/SUMMARY.md` — Executive summary of all research findings

### Codebase
- `packages/db/src/schema.ts` — Single source of truth for Drizzle schema (30+ tables, ~2900 lines)
- `.planning/codebase/CONCERNS.md` — Known bugs and tech debt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/schema.ts` — 30+ table Drizzle schema, single file, ~2900 lines on main
- `db-adapter.ts` — Dual-driver pattern auto-switches Neon vs local Postgres
- `.auto-claude/worktrees/tasks/` — Task tracking files for some worktrees (015, 017, 020, 021)

### Established Patterns
- Drizzle ORM with `drizzle-kit push` for schema sync (no SQL init scripts)
- All AI files have `delete process.env.CLAUDECODE` before `query()` calls
- `withApiHandler()` wraps all internal API routes
- `getAuthorizedWorkspace()` is the correct auth pattern (10 routes still use the wrong ownerId pattern)

### Integration Points
- Merged code connects through: API routes → lib layer → db package
- Schema changes propagate: schema.ts → drizzle-kit generate → migration files → push to DB
- 10 active worktree branches diverge from main at various points

</code_context>

<specifics>
## Specific Ideas

- User wants "no branch left behind" — every branch must merge, no matter the conflict difficulty
- Full audit of 001-030 with gap fixes BEFORE any new merges
- Research identified 3 branches modify schema independently (031, 034, 040) — merge these last
- 7/10 branches are 382 lines behind main in schema.ts — every merge will conflict there

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-worktree-convergence*
*Context gathered: 2026-03-23*
