# Worktree Consolidation Plan v2

## Status: AWAITING APPROVAL

## Situation

- **9 worktrees** pending merge onto main
- **Main branch build is BROKEN** — schema.ts has relations referencing 9 undefined tables
- **Live DB has 45 tables**, schema only defines 30
- **6 branches already merged** (001, 005, 006, 007, 012, 016) but left schema incomplete
- Branches have varying divergence from main (0 to 308 file deletions)

## Root Cause

During previous merges, relation definitions were included but pgTable() definitions were not. The 9 missing tables (`agentRuns`, `writingSkills`, `sessionBookmarks`, `automationRuns`, `usageEvents`, `postConversations`, `writingStyleProfiles`, `postRevisions`, `contentAssets`) exist in all worktrees as a shared base.

---

## Phase 0: Fix Main Build (BLOCKER)

**Goal:** Get main building again by adding the 9 missing pgTable() definitions.

**Source:** Extract from worktree 002 (cleanest — 0 deletions from main).

**Missing tables to add:**
1. `agentRuns`
2. `writingSkills`
3. `sessionBookmarks`
4. `automationRuns`
5. `usageEvents`
6. `usageMonthlySummary`
7. `postConversations`
8. `writingStyleProfiles`
9. `postRevisions`
10. `contentAssets`
11. `integrationSettings`
12. `platformSettings`
13. `webhookEndpoints`
14. `wordpressConnections`
15. `contentMetrics`
16. `subscriptions`

**Validation Gate:** `npm run build` passes with exit code 0.

---

## Phase 1: Safe Direct Merges

### 1A: Merge 009 (Content Series/Collections)
- **Risk:** LOW (8 new files, 2 deleted)
- **New Pages:** Series list page, Series detail page
- **New APIs:** Public collections endpoint, series posts management
- **New Components:** drag-drop reorder, series nav links
- **Schema:** Enhances existing collections/series tables (duplicate defs — needs dedup)
- **File Ownership:** `src/app/(dashboard)/[workspace]/series/`, `src/app/api/series/[id]/posts/`, `src/app/api/public/collections/`, `src/components/series/`, `src/hooks/use-series.ts`
- **Validation:** Navigate to /{workspace}/series, verify list renders, verify series detail page loads

### 1B: Merge 002 (Content Scheduling/Publish Queue)
- **Risk:** LOW (25 new files, 0 deleted)
- **New Pages:** Calendar page, Schedule page
- **New APIs:** Schedule CRUD, publish endpoint
- **New Components:** calendar-view, publish-queue, schedule-modal, recent-activity
- **Schema:** Adds `scheduledPublications` table
- **File Ownership:** `src/app/(dashboard)/[workspace]/calendar/`, `src/app/(dashboard)/[workspace]/schedule/`, `src/app/api/schedule/`, `src/components/scheduling/`, `src/hooks/use-schedule.ts`, `src/lib/scheduling/`
- **Validation:** Navigate to /{workspace}/schedule, verify queue renders, verify calendar view

---

## Phase 2: Moderate Risk Merges (Selective Copy Strategy)

For each: rebase onto current main OR selectively copy new files + update schema.

### 2A: Merge 014 (SEO/GEO Optimization)
- **Risk:** MODERATE (18 new, 69 deleted — old base)
- **Strategy:** Copy new files only, update schema
- **New APIs:** SEO analyze, generate-meta endpoints
- **New Components:** geo-checklist, keyword-suggestions, meta-fields, readability-score, seo-panel, seo-preview
- **New Libs:** geo-optimizer, keyword-extractor, meta-generator, readability-scorer, structured-data-generator
- **File Ownership:** `src/app/api/content/[id]/seo/analyze/`, `src/app/api/content/[id]/seo/generate-meta/`, `src/components/seo/`, `src/hooks/use-seo.ts`, `src/lib/seo/`
- **Validation:** Open content editor, click SEO tab, verify panel renders with readability score

### 2B: Merge 004 (Batch Operations)
- **Risk:** MODERATE (18 new, 58 deleted)
- **Strategy:** Copy new files only, update schema
- **New APIs:** Batch operations for sessions/insights/posts, job tracking
- **New Components:** multi-select-toolbar, job-progress-modal
- **Schema:** Adds `batchJobs` table
- **File Ownership:** `src/app/api/sessions/batch/`, `src/app/api/insights/batch/`, `src/app/api/posts/batch/`, `src/app/api/jobs/`, `src/components/batch/`, `src/hooks/use-batch-operations.ts`, `src/hooks/use-job-progress.ts`, `src/lib/queue/`
- **Validation:** Navigate to sessions page, verify multi-select toolbar appears, verify batch action triggers

### 2C: Merge 003 (Medium Publishing)
- **Risk:** MODERATE (8 new, 69 deleted)
- **Strategy:** Copy new files only, update schema
- **New APIs:** Medium OAuth, publish
- **New Components:** medium-publish-modal
- **Schema:** Adds `mediumIntegrations`, `mediumPublications`
- **File Ownership:** `src/app/api/integrations/medium/`, `src/components/publishing/medium-publish-modal.tsx`, `src/hooks/use-medium.ts`, `src/lib/integrations/medium.ts`
- **Validation:** Open editor, verify Medium publish option appears in dropdown

### 2D: Merge 011 (Recommendations Engine)
- **Risk:** MODERATE (12 new, 71 deleted)
- **Strategy:** Copy new files only, update schema
- **New Pages:** Recommendations page
- **New APIs:** Recommendations CRUD, generate, rate
- **Schema:** Adds `postPerformanceMetrics`, `contentRecommendations`
- **File Ownership:** `src/app/(dashboard)/[workspace]/recommendations/`, `src/app/api/recommendations/`, `src/app/api/content/[id]/performance/`, `src/components/recommendations-card.tsx`, `src/hooks/use-recommendations.ts`, `src/lib/ai/agents/recommendations-analyzer.ts`, `src/lib/ai/prompts/recommendations.ts`, `src/lib/ai/tools/performance-analyzer.ts`
- **Validation:** Navigate to /{workspace}/recommendations, verify page renders

### 2E: Merge 008 (AI Calendar Intelligence)
- **Risk:** MODERATE (13 new, 59 deleted)
- **Strategy:** Copy new files only, update schema
- **New APIs:** Content strategist agent, recommendations feedback
- **Schema:** Adds `engagementMetrics`, `contentRecommendations`, `recommendationFeedback`
- **File Ownership:** `src/app/api/agents/strategist/`, `src/app/api/content/recommendations/`, `src/components/content/recommendation-card.tsx`, `src/hooks/use-recommendations.ts`, `src/lib/ai/agents/content-strategist.ts`, `src/lib/ai/prompts/content-strategist.ts`, `src/lib/ai/tools/analytics-tools.ts`, `src/lib/ai/tools/recommendation-tools.ts`
- **Validation:** Navigate to content calendar, verify AI recommendations appear
- **CONFLICT NOTE:** Shares `use-recommendations.ts` with 011 — merge 011 first, then reconcile

---

## Phase 3: High Risk Extractions

### 3A: Merge 010 (Social Media Engagement Analytics)
- **Risk:** HIGH (20 new, 304 deleted — very old base)
- **Strategy:** EXTRACT new files only — do NOT merge branch
- **New APIs:** Twitter/LinkedIn OAuth, social analytics sync
- **New Components:** metrics-card, platform-comparison, trend-chart
- **Schema:** Adds `twitterIntegrations`, `linkedinIntegrations`, `twitterPublications`, `linkedinPublications`, `socialAnalytics`
- **File Ownership:** `src/app/api/integrations/twitter/`, `src/app/api/integrations/linkedin/`, `src/app/api/analytics/social/`, `src/app/api/automation/social-sync/`, `src/components/analytics/`, `src/lib/integrations/twitter.ts`, `src/lib/integrations/linkedin.ts`
- **Validation:** Navigate to analytics, verify social analytics section renders

### 3B: Merge 015 (Evidence Citations/Source Linking)
- **Risk:** HIGH (2 new TS files, 308 deleted — very old base)
- **Strategy:** INVESTIGATE modifications only. Zero new TS files means all value is in changes to existing files. Likely overlaps with what's already on main.
- **Decision:** SKIP unless audit agents find critical modifications
- **Validation:** N/A unless merged

---

## Communication Protocol

- **Schema file:** ONLY Phase 0 agent touches schema.ts. All other phases get schema frozen after Phase 0.
- **Shared files:** `app-sidebar.tsx`, `layout.tsx`, navigation hooks — Lead handles these after all branches merged.
- **Port 3000:** Only ONE agent runs dev server at a time. Agents coordinate via task status.
- **Browser (Playwright):** Only ONE agent uses browser validation at a time. Sequential validation after each merge.

## Validation Protocol

After EACH merge:
1. `npm run build` passes (exit 0)
2. Dev server starts without errors
3. Playwright navigates to new pages/features
4. Screenshot captured as evidence
5. Console errors = ZERO

## Worktree Cleanup

After merge + validation of each branch:
```bash
git worktree remove .auto-claude/worktrees/tasks/{branch-name}
git branch -d auto-claude/{branch-name}
```

---

## Execution Order Summary

| Order | Branch | Strategy | Schema Adds | New Pages |
|-------|--------|----------|-------------|-----------|
| 0 | (fix main) | Add missing tables | 16 tables | - |
| 1A | 009-series | Direct merge | - | Series list, detail |
| 1B | 002-scheduling | Direct merge | scheduledPublications | Calendar, Schedule |
| 2A | 014-seo | Copy new files | - | - (editor tab) |
| 2B | 004-batch | Copy new files | batchJobs | - (toolbar) |
| 2C | 003-medium | Copy new files | medium* (2) | - (modal) |
| 2D | 011-recommendations | Copy new files | perf/recs (2) | Recommendations |
| 2E | 008-ai-calendar | Copy new files | engagement/recs (3) | - (calendar AI) |
| 3A | 010-social | Extract only | twitter/linkedin (5) | - (analytics) |
| 3B | 015-evidence | SKIP/investigate | - | - |
