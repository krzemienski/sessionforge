# Merge Manifest

**Generated:** 2026-03-23
**Main HEAD:** f4aa790
**Per decisions:** D-03 (merge all 9, skip 038), D-04 (risk-tier order), D-06 (038 skipped)

## Merge Order (per D-04)

### Tier 1: Low-Risk (non-schema, UI-only)
| # | Branch | Files | Insertions | Deletions | Schema | Test Files | Risk | Commits Behind |
|---|--------|-------|------------|-----------|--------|------------|------|----------------|
| 1 | 037-wcag-accessibility-compliance | 40 | 682 | 66 | No | 1 (discard) | LOW | 183 |
| 2 | 041-mobile-responsive-dashboard | 20 | 2505 | 493 | No | No | LOW | 183 |
| 3 | 036-series-collection-filtering | 6 | 1155 | 225 | No | No | LOW | 183 |

### Tier 2: Schema-Touching
| # | Branch | Files | Insertions | Deletions | Schema | Test Files | Risk | Commits Behind |
|---|--------|-------|------------|-----------|--------|------------|------|----------------|
| 4 | 035-content-versioning-visual-diff | 7 | 1082 | 114 | No* | No | MEDIUM | 183 |
| 5 | 031-a-b-headline-experimentation | 16 | 3146 | 1 | YES (2 enums + 3 tables + relations) | No | HIGH | 89 |
| 6 | 034-voice-calibration-engine | 20 | 1544 | 19 | YES (7 columns) | 2 (discard) | HIGH | 13 |

*035 does not modify schema.ts despite tier placement. Classified here per D-04 merge order.

### Tier 3: Cross-Cutting
| # | Branch | Files | Insertions | Deletions | Schema | Test Files | Risk | Commits Behind |
|---|--------|-------|------------|-----------|--------|------------|------|----------------|
| 7 | 039-structured-data-seo | 17 | 3721 | 44 | No | 2 (discard) | MEDIUM | 183 |
| 8 | 040-ai-repurposing-engine | 31 | 2874 | 80 | YES (enum value) | 11 (discard) | HIGH | 183 |
| 9 | 032-compliance-billing | 8 | 2148 | 0 | No | No | LOW | 183 |

### SKIPPED
| Branch | Files | Insertions | Reason |
|--------|-------|------------|--------|
| 038-comprehensive-test-coverage | 29 | 15,428 | ALL files are .test.ts/.spec.ts/vitest config. Violates no-mock mandate (D-06). Zero production code. |

## Conflict Hotspots

Files modified by 3+ branches (will require sequential resolution):

| File | Branches | Merge Position | Strategy |
|------|----------|----------------|----------|
| content/[postId]/page.tsx | 037, 041, 035, 031, 034 | 1st, 2nd, 4th, 5th, 6th | Additive tabs/panels; accept prior, add new |
| schema.ts | 031, 034, 040 | 5th, 6th, 8th | Main-first (D-08); cherry-pick additions only |
| settings/page.tsx | 037, 034, 032 | 1st, 6th, 9th | Each adds settings tab; accept cumulative |
| content/page.tsx | 037, 041, 040 | 1st, 2nd, 8th | Additive content list changes |

## File Overlap Matrix

Files modified by 2+ branches:

| File | Branches |
|------|----------|
| `apps/dashboard/src/app/(dashboard)/[workspace]/content/[postId]/page.tsx` | 031, 034, 035, 037, 041 |
| `packages/db/src/schema.ts` | 031, 034, 040 |
| `apps/dashboard/src/app/(dashboard)/[workspace]/settings/page.tsx` | 032, 034, 037 |
| `apps/dashboard/src/app/(dashboard)/[workspace]/content/page.tsx` | 037, 040, 041 |
| `apps/dashboard/src/components/layout/workspace-shell.tsx` | 037, 041 |
| `apps/dashboard/src/components/layout/mobile-bottom-nav.tsx` | 037, 041 |
| `apps/dashboard/src/components/content/content-list-view.tsx` | 037, 041 |
| `apps/dashboard/src/components/content/batch-repurpose-dialog.tsx` | 037, 040 |
| `apps/dashboard/src/components/editor/revision-history-panel.tsx` | 035, 037 |
| `apps/dashboard/src/app/(dashboard)/[workspace]/page.tsx` | 037, 041 |
| `apps/dashboard/src/app/globals.css` | 037, 041 |
| `apps/dashboard/src/lib/style/profile-injector.ts` | 034, 040 |
| `apps/dashboard/src/lib/export/markdown-export.ts` | 039, 040 |
| `apps/dashboard/src/lib/ai/agents/repurpose-writer.ts` | 034, 040 |
| `apps/dashboard/src/lib/ai/agents/__tests__/insight-extractor.test.ts` | 034, 040 (discard both) |

## Test Files to Discard During Merge

| Branch | Files to Discard |
|--------|-----------------|
| 037 | `apps/dashboard/tests/a11y/axe-audit.spec.ts` |
| 034 | `apps/dashboard/src/lib/ai/agents/__tests__/insight-extractor.test.ts`, `apps/dashboard/src/lib/ai/agents/__tests__/newsletter-writer.test.ts` |
| 039 | `apps/dashboard/src/lib/seo/structured-data-generator.test.ts`, `apps/dashboard/src/lib/seo/structured-data-validator.test.ts` |
| 040 | `apps/dashboard/src/app/api/__tests__/automation-triggers.test.ts`, `apps/dashboard/src/app/api/__tests__/bulk-repurpose.test.ts`, `apps/dashboard/src/app/api/__tests__/content.test.ts`, `apps/dashboard/src/app/api/__tests__/devto-integration.test.ts`, `apps/dashboard/src/app/api/__tests__/insights.test.ts`, `apps/dashboard/src/app/api/__tests__/sessions.test.ts`, `apps/dashboard/src/lib/ai/agents/__tests__/insight-extractor.test.ts`, `apps/dashboard/src/lib/ai/agents/__tests__/repurpose-writer.test.ts`, `apps/dashboard/src/lib/automation/__tests__/pipeline.test.ts`, `apps/dashboard/src/lib/sessions/__tests__/indexer.test.ts`, `apps/dashboard/src/lib/style/__tests__/profile-injector.test.ts`, `apps/dashboard/src/__test-utils__/shared-schema-mock.ts` |

## Schema Modifications by Branch

| Branch | Changes | Schema Line Count (branch) | Main Line Count |
|--------|---------|---------------------------|-----------------|
| 031 | 2 new pgEnums (`experimentStatusEnum`, `experimentKpiEnum`), 3 tables (`experiments`, `experimentVariants`, `experimentResults`), 3 relation definitions | 2880 | 2902 |
| 034 | 7 new columns on `writingStyleProfiles` (`customInstructions`, `vocabularyFingerprint`, `antiAiPatterns`, `calibratedFromSamples`, `formalityOverride`, `humorOverride`, `technicalDepthOverride`) | 2909 | 2902 |
| 040 | 1 new enum value (`"doc_page"` added to `contentTypeEnum`) | 2521 | 2902 |

## Branch-Specific Migration Files to Delete

| Branch | File | Reason |
|--------|------|--------|
| 034 | `packages/db/migrations/add_voice_calibration_columns.sql` | Branch-specific; replaced by regenerated migrations (D-07) |
| 040 | `packages/db/migrations/add_doc_page_enum.sql` | Branch-specific; replaced by regenerated migrations (D-07) |
| 040 | `DATABASE_MIGRATION_NOTES.md` | Branch-specific documentation; no longer needed after regeneration |

## Merge-Base Summary

| Branch | Merge-Base | Commits Behind Main |
|--------|------------|---------------------|
| 031 | 0fa0b94 | 89 |
| 032 | 2e65861 | 183 |
| 034 | 499baf7 | 13 |
| 035 | 2e65861 | 183 |
| 036 | 2e65861 | 183 |
| 037 | 2e65861 | 183 |
| 038 | 2e65861 | 183 (SKIPPED) |
| 039 | 2e65861 | 183 |
| 040 | 2e65861 | 183 |
| 041 | 2e65861 | 183 |

**Key observation:** 8 of 10 branches share the same merge-base (`2e65861`, 183 commits behind). Branch 034 diverged much more recently (only 13 commits behind) and branch 031 moderately recently (89 commits behind). This means 034's schema conflict will be minimal while all `2e65861`-based branches will face significant divergence from main.
