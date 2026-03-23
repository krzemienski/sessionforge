---
phase: 01-worktree-convergence
plan: 04
subsystem: infra
tags: [git-merge, schema, drizzle, billing, repurpose, seo, structured-data]

# Dependency graph
requires:
  - phase: 01-worktree-convergence/plan-03
    provides: "Tier 2 schema-touching branches merged (031, 034, 035)"
provides:
  - "All 9 worktree branches merged into main"
  - "Converged schema with doc_page enum value from 040"
  - "Regenerated Drizzle migrations from final converged schema"
  - "Billing API routes and settings tab from 032"
  - "AI content repurposing engine from 040"
  - "Structured data SEO features from 039"
affects: [01-worktree-convergence/plan-05, 02-containerization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Main-first schema conflict resolution (D-08): checkout --ours then surgical additions"
    - "Migration regeneration after schema changes (D-07): rm old, drizzle-kit generate"
    - "Test file exclusion on merge: git reset HEAD then discard"

key-files:
  created:
    - apps/dashboard/src/app/api/content/bulk-repurpose/route.ts
    - apps/dashboard/src/components/content/bulk-repurpose-dialog.tsx
    - apps/dashboard/src/lib/ai/prompts/repurpose/doc-page-from-post.ts
    - apps/dashboard/src/lib/ai/prompts/repurpose/linkedin-from-post.ts
    - apps/dashboard/src/lib/ai/prompts/repurpose/newsletter-section-from-post.ts
    - apps/dashboard/src/lib/ai/prompts/repurpose/twitter-from-post.ts
    - apps/dashboard/src/app/api/billing/cancel-preview/route.ts
    - apps/dashboard/src/app/api/billing/cancel/route.ts
    - apps/dashboard/src/app/api/billing/downgrade-preview/route.ts
    - apps/dashboard/src/app/api/billing/downgrade/route.ts
    - apps/dashboard/src/app/api/billing/export/route.ts
    - apps/dashboard/src/app/api/billing/history/route.ts
    - apps/dashboard/src/components/settings/billing-tab.tsx
    - packages/db/migrations/0000_slimy_edwin_jarvis.sql
  modified:
    - packages/db/src/schema.ts
    - apps/dashboard/src/app/(dashboard)/[workspace]/content/page.tsx
    - apps/dashboard/src/app/(dashboard)/[workspace]/settings/page.tsx
    - apps/dashboard/src/components/content/batch-repurpose-dialog.tsx
    - apps/dashboard/src/components/content/repurpose-button.tsx
    - apps/dashboard/src/hooks/use-repurpose.ts
    - apps/dashboard/src/lib/ai/agents/repurpose-writer.ts
    - apps/dashboard/src/lib/export/markdown-export.ts
    - apps/dashboard/src/lib/style/profile-injector.ts
    - apps/dashboard/src/types/templates.ts

key-decisions:
  - "Added billing tab with ARIA tabpanel attributes consistent with 037 a11y merge"
  - "Coerced invoice_pdf undefined to null for type safety in billing history route"

patterns-established:
  - "Merge conflict resolution for settings tabs: accept all prior ARIA-attributed panels, add new tab entries with matching ARIA attributes"

requirements-completed: [CONV-03]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 01 Plan 04: Tier 3 Cross-Cutting Branch Merges Summary

**Merged 3 Tier 3 branches (039 structured-data SEO, 040 AI repurposing engine, 032 compliance billing) completing all 9 worktree merges with converged schema and regenerated migrations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T06:04:45Z
- **Completed:** 2026-03-23T06:10:05Z
- **Tasks:** 3 (Task 1 completed by prior agent)
- **Files modified:** 28 (across all 3 merges in this plan)

## Accomplishments

- All 9 worktree branches (037, 041, 036, 035, 031, 034, 039, 040, 032) merged into main
- Schema converged with all additions: experimentStatusEnum, experimentKpiEnum, experiments (031), authenticityScore (034), doc_page (040)
- Drizzle migrations regenerated from final converged schema
- 13 test files from 039/040 discarded per no-mock mandate
- Billing API routes (cancel, downgrade, export, history) and billing settings tab added from 032
- AI content repurposing engine with 4 format-specific prompts added from 040
- CLAUDECODE env fix preserved in 15 files (exceeds 12 minimum)
- Production build passes on final state

## Task Commits

Each task was committed atomically:

1. **Task 1: Merge branch 039 (structured data SEO)** - `53fbfe5` (merge) -- completed by prior agent
2. **Task 2: Merge branch 040 (AI repurposing engine)** - `020022c` (merge)
3. **Task 3: Merge branch 032 (compliance billing trust center)** - `82ef7be` (merge)

## Files Created/Modified

### Task 1 (039) - Prior agent
- Structured data SEO features (~17 files, 2 test files discarded)

### Task 2 (040) - 20 files
- `packages/db/src/schema.ts` - Added "doc_page" to contentTypeEnum
- `packages/db/migrations/0000_slimy_edwin_jarvis.sql` - Regenerated migration
- `apps/dashboard/src/app/api/content/bulk-repurpose/route.ts` - New bulk repurpose API
- `apps/dashboard/src/components/content/bulk-repurpose-dialog.tsx` - New bulk repurpose dialog
- `apps/dashboard/src/lib/ai/prompts/repurpose/*.ts` - 4 format-specific repurpose prompts (doc-page, linkedin, newsletter-section, twitter)
- `apps/dashboard/src/lib/ai/agents/repurpose-writer.ts` - Enhanced repurpose agent
- `apps/dashboard/src/hooks/use-repurpose.ts` - Repurpose React hook
- `apps/dashboard/src/types/templates.ts` - Template type additions
- `apps/dashboard/src/components/content/batch-repurpose-dialog.tsx` - Batch repurpose dialog
- `apps/dashboard/src/components/content/repurpose-button.tsx` - Repurpose button component
- `apps/dashboard/src/lib/export/markdown-export.ts` - Export additions
- `apps/dashboard/src/lib/style/profile-injector.ts` - Profile injector additions
- `apps/dashboard/src/app/(dashboard)/[workspace]/content/page.tsx` - Content page repurpose UI
- `apps/dashboard/src/app/api/agents/repurpose/route.ts` - Repurpose agent route
- `apps/dashboard/src/app/api/content/[id]/batch-repurpose/route.ts` - Batch repurpose route

### Task 3 (032) - 8 files
- `apps/dashboard/src/app/(dashboard)/[workspace]/settings/page.tsx` - Added billing tab with ARIA attributes
- `apps/dashboard/src/app/api/billing/cancel-preview/route.ts` - Subscription cancel preview
- `apps/dashboard/src/app/api/billing/cancel/route.ts` - Subscription cancellation
- `apps/dashboard/src/app/api/billing/downgrade-preview/route.ts` - Plan downgrade preview
- `apps/dashboard/src/app/api/billing/downgrade/route.ts` - Plan downgrade
- `apps/dashboard/src/app/api/billing/export/route.ts` - Billing data export
- `apps/dashboard/src/app/api/billing/history/route.ts` - Billing history with invoice data
- `apps/dashboard/src/components/settings/billing-tab.tsx` - Billing settings tab component

## Decisions Made

- Settings/page.tsx conflict resolved by keeping all HEAD ARIA-attributed tab panels (from 037 a11y merge) and adding 032's billing tab with matching ARIA attributes for consistency
- 034 voice calibration column names accepted as-is (customInstructions, not voiceArchetype) per prior plan decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invoice_pdf type error in billing history route**
- **Found during:** Task 3 (032 merge)
- **Issue:** `invoice.invoice_pdf` is `string | null | undefined` from Stripe SDK but metadata field expects `string | number | null` (no undefined)
- **Fix:** Added null coalescing: `invoice.invoice_pdf ?? null`
- **Files modified:** apps/dashboard/src/app/api/billing/history/route.ts
- **Verification:** Build passes after fix
- **Committed in:** 82ef7be (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Type safety fix required for build to pass. No scope creep.

## Issues Encountered

- Settings/page.tsx had expected 3-way conflict (037 a11y + 034 voice + 032 billing). Resolved by accepting all HEAD content (with ARIA attributes from prior merges) and adding 032's billing tab with matching ARIA pattern.

## Known Stubs

None -- all merged code is functional implementation, not placeholder.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- All 9 branch merges complete (CONV-03 satisfied)
- Ready for Plan 05: final validation and cleanup
- Schema fully converged with all branch additions
- Production build passes

---
*Phase: 01-worktree-convergence*
*Completed: 2026-03-23*
