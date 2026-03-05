---
title: "Worktree Consolidation v3 - Meticulous Merge + Full Functional Validation"
description: "Merge 9 pending worktrees onto main with per-step browser validation, SDK fixes, and full UI audit"
status: pending
priority: P1
effort: 16h
branch: main
tags: [worktree, consolidation, merge, validation, schema, ui-audit]
created: 2026-03-05
---

# Worktree Consolidation v3 - Comprehensive Plan

## Table of Contents

1. [Worktree Deep Audit Results](#section-1-worktree-deep-audit-results)
2. [Phase 0 - Fix Main Build](#section-2-phase-0--fix-main-build)
3. [Merge Sequence with Validation Gates](#section-3-merge-sequence-with-validation-gates)
4. [Team Coordination Protocol](#section-4-team-coordination-protocol)
5. [Full Application Audit](#section-5-full-application-audit)
6. [Final Validation Gate](#section-6-final-validation-gate)

---

## Section 1: Worktree Deep Audit Results

### 1.1 Worktree 002 - Content Scheduling & Publish Queue

**Purpose:** Calendar-based content scheduling with publish queue. Users set publish dates/times with timezone, view scheduled content on a calendar, and a QStash-powered background job publishes at the scheduled time.

**New Files (source only, excluding tests/migrations):**

| Type | Path |
|------|------|
| Page | `apps/dashboard/src/app/(dashboard)/[workspace]/calendar/page.tsx` |
| Page | `apps/dashboard/src/app/(dashboard)/[workspace]/schedule/page.tsx` |
| API | `apps/dashboard/src/app/api/schedule/route.ts` |
| API | `apps/dashboard/src/app/api/schedule/[id]/route.ts` |
| API | `apps/dashboard/src/app/api/schedule/publish/route.ts` |
| Component | `apps/dashboard/src/components/scheduling/calendar-view.tsx` |
| Component | `apps/dashboard/src/components/scheduling/publish-queue.tsx` |
| Component | `apps/dashboard/src/components/scheduling/recent-activity.tsx` |
| Component | `apps/dashboard/src/components/scheduling/schedule-modal.tsx` |
| Hook | `apps/dashboard/src/hooks/use-schedule.ts` |
| Lib | `apps/dashboard/src/lib/scheduling/publisher.ts` |

**Schema Changes:**
- Table: `scheduledPublications` (id, workspaceId, postId, scheduledAt, timezone, status, publishedAt, error, retryCount, createdAt, updatedAt)
- Enum: `scheduledPublicationStatusEnum` (pending, publishing, published, failed, cancelled)
- Also adds 5 enums missing from main: `editTypeEnum`, `versionTypeEnum`, `metricsPlatformEnum`, `contentAssetTypeEnum`, `scheduledPublicationStatusEnum`
- Also adds 16 missing pgTable definitions that fix main build (see Phase 0)

**UI Navigation:**
- `/{workspace}/calendar` -- Calendar view showing scheduled + published content
- `/{workspace}/schedule` -- Publish queue with chronological list, drag-to-reorder

**Dependencies:** None. This is the foundation worktree (cleanest base, 0 deletions from main).

**Known Issues:** Contains test files in `tests/` directory -- must exclude during merge (VIOLATION of no-test-files rule).

**PASS Criteria for Functional Validation:**
1. `/{workspace}/schedule` page loads without console errors
2. Schedule page shows a publish queue UI (even if empty)
3. `/{workspace}/calendar` page loads with a calendar component visible
4. Schedule modal opens when clicking "Schedule" button
5. Calendar view renders month grid with day cells
6. No 500 errors from `/api/schedule` endpoints

---

### 1.2 Worktree 009 - Content Series & Collections

**Purpose:** Group posts into ordered Series (Part 1, 2, 3...) and unordered Collections (portfolio groupings). Series auto-add prev/next navigation links. Collections generate shareable public URLs.

**New Files:**

| Type | Path |
|------|------|
| Page | `apps/dashboard/src/app/(dashboard)/[workspace]/series/page.tsx` |
| Page | `apps/dashboard/src/app/(dashboard)/[workspace]/series/[seriesId]/page.tsx` |
| Page | `apps/dashboard/src/app/(dashboard)/[workspace]/collections/page.tsx` (enhanced) |
| Page | `apps/dashboard/src/app/(dashboard)/[workspace]/collections/[collectionId]/page.tsx` |
| API | `apps/dashboard/src/app/api/series/route.ts` |
| API | `apps/dashboard/src/app/api/series/[id]/route.ts` |
| API | `apps/dashboard/src/app/api/series/[id]/posts/route.ts` |
| API | `apps/dashboard/src/app/api/collections/route.ts` (enhanced) |
| API | `apps/dashboard/src/app/api/collections/[id]/route.ts` (enhanced) |
| API | `apps/dashboard/src/app/api/collections/[id]/posts/route.ts` |
| API | `apps/dashboard/src/app/api/public/collections/[workspace]/[slug]/route.ts` |
| Component | `apps/dashboard/src/components/series/drag-drop-reorder.tsx` |
| Component | `apps/dashboard/src/components/series/series-nav-links.tsx` |
| Hook | `apps/dashboard/src/hooks/use-series.ts` |
| Hook | `apps/dashboard/src/hooks/use-collections.ts` |

**Schema Changes:**
- 009 adds duplicate `series`, `collections`, `seriesPosts`, `collectionPosts` pgTable defs (already on main) -- must SKIP these and only take new files
- Adds `isPublic` and `coverImage` columns to existing collections table (migration `0004_collections_ispublic_coverimage.sql`)

**Modified Files (on main):**
- `apps/dashboard/src/app/(dashboard)/[workspace]/content/[postId]/page.tsx` (minor, +16 lines)
- `apps/dashboard/src/app/api/content/[id]/route.ts` (minor, +10/-1)
- `apps/dashboard/src/app/api/feed/[...slug]/route.ts` (significant, +190/-21 -- RSS scoping)
- `apps/dashboard/src/components/layout/app-sidebar.tsx` (+4 lines -- adds Series nav link)
- `packages/db/src/schema.ts` (+133 lines -- duplicate table defs, SKIP)

**UI Navigation:**
- `/{workspace}/series` -- List of all series with create button
- `/{workspace}/series/[seriesId]` -- Series detail with ordered post list, drag-drop reorder
- `/{workspace}/collections` -- Enhanced collections page (already exists, gets new features)
- `/{workspace}/collections/[collectionId]` -- Collection detail with post list

**Dependencies:** Main must have `series`, `collections`, `seriesPosts`, `collectionPosts` tables (already present).

**Known Issues:**
- Has 12 UNMERGED files with merge conflicts from prior failed rebase
- Schema defs duplicate what's on main -- must use selective file copy, NOT git merge
- Sidebar modification adds "Series" nav link -- conflicts possible with other worktrees modifying sidebar

**PASS Criteria:**
1. `/{workspace}/series` page loads, shows empty state or list
2. Create Series button is visible and opens a form/modal
3. `/{workspace}/collections` page loads with enhanced UI
4. Collection detail page shows posts list
5. Series nav link appears in sidebar
6. Drag-drop reorder component renders in series detail
7. No console errors on any series/collection page

---

### 1.3 Worktree 014 - SEO & Generative Engine Optimization (GEO)

**Purpose:** Comprehensive SEO + GEO toolkit in content editor. Keyword research from session content, readability scoring (Flesch-Kincaid), structured data (JSON-LD), AI search visibility optimization, per-platform previews.

**New Files:**

| Type | Path |
|------|------|
| API | `apps/dashboard/src/app/api/content/[id]/seo/analyze/route.ts` |
| API | `apps/dashboard/src/app/api/content/[id]/seo/generate-meta/route.ts` |
| Component | `apps/dashboard/src/components/seo/geo-checklist.tsx` |
| Component | `apps/dashboard/src/components/seo/keyword-suggestions.tsx` |
| Component | `apps/dashboard/src/components/seo/meta-fields.tsx` |
| Component | `apps/dashboard/src/components/seo/readability-score.tsx` |
| Component | `apps/dashboard/src/components/seo/seo-panel.tsx` |
| Component | `apps/dashboard/src/components/seo/seo-preview.tsx` |
| Hook | `apps/dashboard/src/hooks/use-seo.ts` |
| Lib | `apps/dashboard/src/lib/seo/geo-optimizer.ts` |
| Lib | `apps/dashboard/src/lib/seo/keyword-extractor.ts` |
| Lib | `apps/dashboard/src/lib/seo/meta-generator.ts` |
| Lib | `apps/dashboard/src/lib/seo/readability-scorer.ts` |
| Lib | `apps/dashboard/src/lib/seo/structured-data-generator.ts` |

**EXCLUDE (test files -- VIOLATION):**
- `apps/dashboard/src/lib/seo/geo-optimizer.test.ts`
- `apps/dashboard/src/lib/seo/keyword-extractor.test.ts`
- `apps/dashboard/src/lib/seo/readability-scorer.test.ts`
- `apps/dashboard/src/lib/seo/structured-data-generator.test.ts`

**Schema Changes:** None new (migration 0004 adds columns but may conflict with existing schema).

**UI Navigation:**
- Content editor SEO tab (already exists on main -- this enhances it with full panel)
- SEO panel renders inside editor at `/{workspace}/content/[postId]`

**Dependencies:** Existing SEO generator at `src/lib/seo/generator.ts` (already on main). Must not overwrite.

**Known Issues:**
- 4 test files must be excluded
- 69 deleted files indicate very divergent base -- use selective file copy only
- `meta-generator.ts` may conflict with existing `generator.ts` in `src/lib/seo/`

**PASS Criteria:**
1. Open content editor at `/{workspace}/content/[postId]`
2. Click SEO tab -- panel loads without error
3. Readability score displays a numeric value
4. Keyword suggestions section renders
5. GEO checklist shows optimization items
6. SEO preview shows Google/social card mockups
7. Meta fields (title, description) are editable
8. No console errors

---

### 1.4 Worktree 004 - Batch Operations for Sessions & Insights

**Purpose:** Multi-select + batch actions across sessions, insights, and posts. Background job queue with progress tracking. Shift-click range selection, select-all, batch extract/generate/archive/delete.

**New Files:**

| Type | Path |
|------|------|
| API | `apps/dashboard/src/app/api/sessions/batch/route.ts` |
| API | `apps/dashboard/src/app/api/insights/batch/route.ts` |
| API | `apps/dashboard/src/app/api/posts/batch/route.ts` |
| API | `apps/dashboard/src/app/api/jobs/[jobId]/route.ts` |
| API | `apps/dashboard/src/app/api/jobs/[jobId]/cancel/route.ts` |
| API | `apps/dashboard/src/app/api/jobs/process/route.ts` |
| Component | `apps/dashboard/src/components/batch/multi-select-toolbar.tsx` |
| Component | `apps/dashboard/src/components/batch/job-progress-modal.tsx` |
| Hook | `apps/dashboard/src/hooks/use-batch-operations.ts` |
| Hook | `apps/dashboard/src/hooks/use-job-progress.ts` |
| Lib | `apps/dashboard/src/lib/queue/batch-processor.ts` |
| Lib | `apps/dashboard/src/lib/queue/job-tracker.ts` |

**Schema Changes:**
- Table: `batchJobs` (id, workspaceId, type, status, totalItems, completedItems, failedItems, results, error, createdAt, updatedAt, completedAt)

**UI Navigation:**
- Multi-select toolbar appears on `/{workspace}/sessions`, `/{workspace}/insights`, `/{workspace}/content` pages when items are selected
- Job progress modal shows progress bar during batch operations

**Dependencies:** None beyond existing pages.

**Known Issues:**
- 58 deleted files -- use selective file copy
- Contains `e2e-evidence/` files and `verify-batch-api.ts` -- exclude

**PASS Criteria:**
1. Navigate to `/{workspace}/sessions` -- page loads normally
2. Checkboxes appear on session list items (or become visible on hover/selection mode)
3. Selecting items shows multi-select toolbar
4. Batch action buttons visible in toolbar (Archive, Delete, Extract Insights)
5. `/{workspace}/content` page shows selection capability
6. No console errors on any page with batch capability

---

### 1.5 Worktree 003 - Medium Publishing Integration

**Purpose:** Add Medium as 4th publishing platform alongside Hashnode, WordPress, Dev.to. OAuth authentication, markdown-to-Medium conversion, canonical URL management.

**New Files:**

| Type | Path |
|------|------|
| API | `apps/dashboard/src/app/api/integrations/medium/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/medium/oauth/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/medium/callback/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/medium/publish/route.ts` |
| Component | `apps/dashboard/src/components/publishing/medium-publish-modal.tsx` |
| Hook | `apps/dashboard/src/hooks/use-medium.ts` |
| Lib | `apps/dashboard/src/lib/integrations/medium.ts` |

**Schema Changes:**
- Table: `mediumIntegrations` (id, workspaceId, accessToken, refreshToken, mediumUserId, username, name, imageUrl, createdAt, updatedAt)
- Table: `mediumPublications` (id, workspaceId, postId, integrationId, mediumPostId, mediumUrl, status, publishedAt, createdAt)

**UI Navigation:**
- `/{workspace}/settings/integrations` -- Medium connect button
- Content editor publish dropdown -- "Publish to Medium" option
- Medium publish modal -- draft/publish mode, tag configuration

**Dependencies:** Requires Medium API OAuth credentials in env vars (MEDIUM_CLIENT_ID, MEDIUM_CLIENT_SECRET).

**Known Issues:**
- 69 deleted files -- use selective file copy
- OAuth requires env vars that won't be set in dev -- UI should show graceful state

**PASS Criteria:**
1. `/{workspace}/settings/integrations` page loads
2. Medium integration card/section visible on integrations page
3. "Connect Medium" button renders (even if OAuth not configured)
4. Content editor shows Medium option in publish dropdown
5. Medium publish modal opens and renders form fields
6. No console errors

---

### 1.6 Worktree 011 - Content Performance Recommendations Engine

**Purpose:** AI-powered analysis of content performance. Generates actionable recommendations: best topics, formats, post length, tags. Weekly digest of top 3 suggestions. Rate recommendations as helpful/unhelpful.

**New Files:**

| Type | Path |
|------|------|
| Page | `apps/dashboard/src/app/(dashboard)/[workspace]/recommendations/page.tsx` |
| API | `apps/dashboard/src/app/api/recommendations/route.ts` |
| API | `apps/dashboard/src/app/api/recommendations/generate/route.ts` |
| API | `apps/dashboard/src/app/api/recommendations/[id]/rate/route.ts` |
| API | `apps/dashboard/src/app/api/content/[id]/performance/route.ts` |
| API | `apps/dashboard/src/app/api/analytics/route.ts` |
| Component | `apps/dashboard/src/components/recommendations-card.tsx` |
| Hook | `apps/dashboard/src/hooks/use-recommendations.ts` |
| Lib | `apps/dashboard/src/lib/ai/agents/recommendations-analyzer.ts` |
| Lib | `apps/dashboard/src/lib/ai/prompts/recommendations.ts` |
| Lib | `apps/dashboard/src/lib/ai/tools/performance-analyzer.ts` |

**Schema Changes:**
- Table: `postPerformanceMetrics` (id, postId, platform, impressions, clicks, likes, comments, shares, ctr, engagementRate, fetchedAt, createdAt)
- Table: `contentRecommendations` (id, workspaceId, type, title, description, reasoning, dataPoints, priority, status, rating, createdAt, expiresAt)

**UI Navigation:**
- `/{workspace}/recommendations` -- Recommendations page with cards

**Dependencies:** None beyond existing workspace/posts.

**Known Issues -- CRITICAL:**
- **SDK VIOLATION:** `recommendations-analyzer.ts` imports `from "@anthropic-ai/sdk"` and uses `new Anthropic()`. MUST be rewritten to use `@anthropic-ai/claude-agent-sdk` `query()` pattern with `delete process.env.CLAUDECODE`.
- `analytics/route.ts` may conflict with existing analytics route on main
- `use-recommendations.ts` CONFLICTS with 008 worktree (same filename, different content -- 73 vs 80 lines)

**PASS Criteria:**
1. `/{workspace}/recommendations` page loads
2. Recommendations cards render (empty state if no data)
3. "Generate Recommendations" button visible
4. No import errors from SDK fix
5. No console errors

---

### 1.7 Worktree 008 - AI-Powered Content Calendar Intelligence

**Purpose:** AI layer on top of content calendar. Analyzes publishing history and engagement to recommend what to publish and when. Optimal timing, gap analysis, content type suggestions.

**New Files:**

| Type | Path |
|------|------|
| API | `apps/dashboard/src/app/api/agents/strategist/route.ts` |
| API | `apps/dashboard/src/app/api/analytics/route.ts` |
| API | `apps/dashboard/src/app/api/content/recommendations/route.ts` |
| API | `apps/dashboard/src/app/api/content/recommendations/[id]/feedback/route.ts` |
| Component | `apps/dashboard/src/components/content/recommendation-card.tsx` |
| Hook | `apps/dashboard/src/hooks/use-recommendations.ts` |
| Lib | `apps/dashboard/src/lib/ai/agents/content-strategist.ts` |
| Lib | `apps/dashboard/src/lib/ai/prompts/content-strategist.ts` |
| Lib | `apps/dashboard/src/lib/ai/tools/analytics-tools.ts` |
| Lib | `apps/dashboard/src/lib/ai/tools/recommendation-tools.ts` |

**Schema Changes:**
- Table: `engagementMetrics` (id, postId, platform, impressions, clicks, likes, comments, shares, fetchedAt, createdAt)
- Table: `contentRecommendations` (shared with 011 -- CONFLICT, must reconcile)
- Table: `recommendationFeedback` (id, recommendationId, userId, rating, comment, createdAt)

**UI Navigation:**
- AI recommendations appear within calendar view (from 002) and content pages
- No dedicated page -- integrates into existing calendar

**Dependencies:**
- 002 (calendar page must exist for AI recommendations to display in)
- 011 (shares `contentRecommendations` table and `use-recommendations.ts` hook)

**Known Issues -- CRITICAL:**
- **SDK VIOLATION:** `content-strategist.ts` imports `from "@anthropic-ai/sdk"` and uses `new Anthropic()`. MUST be rewritten.
- `analytics/route.ts` CONFLICTS with 011's analytics route
- `use-recommendations.ts` CONFLICTS with 011 (different implementation)
- `contentRecommendations` table definition CONFLICTS with 011

**Resolution Strategy:**
- Merge 011 first (gets recommendations page + base hook)
- Rename 008's hook to `use-calendar-recommendations.ts`
- Rename 008's recommendation component to `calendar-recommendation-card.tsx`
- Merge 008's `contentRecommendations` columns into 011's definition
- 008's `analytics/route.ts` becomes `analytics/calendar/route.ts`

**PASS Criteria:**
1. Calendar page (from 002) loads with AI recommendation section
2. Recommendation cards render (empty state OK)
3. Content strategist agent endpoint responds (may require auth)
4. No SDK import errors
5. No console errors

---

### 1.8 Worktree 010 - Social Media Engagement Analytics

**Purpose:** Twitter/X and LinkedIn engagement tracking. OAuth integrations, per-post metrics, cross-platform comparison, trend charts.

**New Files:**

| Type | Path |
|------|------|
| Page | `apps/dashboard/src/app/(dashboard)/[workspace]/analytics/page.tsx` (enhanced) |
| API | `apps/dashboard/src/app/api/analytics/social/route.ts` |
| API | `apps/dashboard/src/app/api/analytics/social/sync/route.ts` |
| API | `apps/dashboard/src/app/api/automation/social-sync/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/twitter/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/twitter/oauth/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/twitter/callback/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/linkedin/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/linkedin/oauth/route.ts` |
| API | `apps/dashboard/src/app/api/integrations/linkedin/callback/route.ts` |
| Component | `apps/dashboard/src/components/analytics/metrics-card.tsx` |
| Component | `apps/dashboard/src/components/analytics/platform-comparison.tsx` |
| Component | `apps/dashboard/src/components/analytics/trend-chart.tsx` |
| Lib | `apps/dashboard/src/lib/integrations/twitter.ts` |
| Lib | `apps/dashboard/src/lib/integrations/linkedin.ts` |

**Schema Changes:**
- Table: `twitterIntegrations` (id, workspaceId, accessToken, refreshToken, twitterUserId, username, createdAt, updatedAt)
- Table: `linkedinIntegrations` (id, workspaceId, accessToken, refreshToken, linkedinUserId, createdAt, updatedAt)
- Table: `twitterPublications` (id, workspaceId, postId, tweetId, tweetUrl, publishedAt, createdAt)
- Table: `linkedinPublications` (id, workspaceId, postId, linkedinPostId, linkedinUrl, publishedAt, createdAt)
- Table: `socialAnalytics` (id, publicationId, platform, impressions, clicks, likes, comments, shares, fetchedAt, createdAt)

**UI Navigation:**
- `/{workspace}/analytics` -- Enhanced analytics page with social media section
- `/{workspace}/settings/integrations` -- Twitter/LinkedIn connect buttons

**Dependencies:** None beyond existing pages.

**Known Issues -- HIGH RISK:**
- **304 deleted files** -- extremely divergent from main. EXTRACT files only, do NOT merge branch.
- Analytics page.tsx replacement must be reconciled with existing analytics page
- OAuth requires env vars (TWITTER_CLIENT_ID etc.) not set in dev

**PASS Criteria:**
1. `/{workspace}/analytics` page loads with social analytics section
2. Metrics cards render (empty state OK without OAuth)
3. Platform comparison component visible
4. Trend chart renders (empty state OK)
5. `/{workspace}/settings/integrations` shows Twitter/LinkedIn cards
6. No console errors

---

### 1.9 Worktree 015 - Evidence Citations & Source Linking

**Purpose:** Auto-cite session evidence in AI-generated content. Footnote-style links from claims to session transcript moments.

**New Files:** Zero new TS files (only migrations).

**Modified Files (from diff):** None vs main (empty diff).

**Status:** INCOMPLETE (~40%). Empty diff against main means no meaningful source code changes survived. All value was in modifications to files that have since been updated on main.

**Decision: SKIP.** No extractable code. Feature would need to be reimplemented from spec.

**PASS Criteria:** N/A -- skipped.

---

## Section 2: Phase 0 -- Fix Main Build

### Problem

Main branch build fails because `packages/db/src/schema.ts` has:
- 16 relation definitions referencing tables with no `pgTable()` definition
- Relations for: `postRevisions`, `postConversations`, `contentAssets`, `subscriptions`, `usageEvents`, `usageMonthlySummary`, `agentRuns`, `writingSkills`, `sessionBookmarks`, `automationRuns` (and their referenced `integrationSettings`, `platformSettings`, `webhookEndpoints`, `wordpressConnections`, `contentMetrics`)
- 5 missing enum definitions: `editTypeEnum`, `versionTypeEnum`, `metricsPlatformEnum`, `contentAssetTypeEnum`, `scheduledPublicationStatusEnum`

### Source

Extract from worktree 002 schema (`packages/db/src/schema.ts`). This worktree has the cleanest base (0 deletions) and contains ALL missing definitions.

### Exact Changes Required

**Step 1:** Add 5 missing enums (copy from 002 schema, lines 66-146):
```
contentAssetTypeEnum
editTypeEnum
metricsPlatformEnum
scheduledPublicationStatusEnum
versionTypeEnum
```

**Step 2:** Add 16 missing pgTable definitions (copy from 002 schema):
```
integrationSettings     (line 273)
sessionBookmarks        (line 496)
contentMetrics          (line 521)
platformSettings        (line 547)
postRevisions           (line 568)
webhookEndpoints        (line 600)
scheduledPublications   (line 853)
agentRuns               (line 929)
writingSkills           (line 950)
automationRuns          (line 978)
wordpressConnections    (line 1006)
postConversations       (line 1025)
subscriptions           (line 1035)
usageEvents             (line 1057)
usageMonthlySummary     (line 1078)
contentAssets           (line 1111)
```

**Step 3:** Add missing `hashnodeIntegrations` and `hashnodePublications` tables (exist in live DB but not in schema -- prevents drizzle-kit sync issues).

### Owner

Single agent: **schema-agent** (exclusive ownership of `packages/db/src/schema.ts`)

### Validation Gate

| Criterion | How to Verify |
|-----------|---------------|
| Build passes | `cd apps/dashboard && npx next build` exits 0 |
| No TypeScript errors | Build output contains "Compiled successfully" |
| Schema exports resolve | `grep -c "export const.*pgTable" packages/db/src/schema.ts` returns 47+ |

**Evidence Required:**
- [ ] Build output quoted showing exit code 0
- [ ] Line count of build output showing all routes compiled
- [ ] `grep` count of pgTable exports

**Skill Invocations:** `gate-validation-discipline`

**Commit Message:** `fix(schema): add 16 missing pgTable definitions and 5 missing enums to fix build`

---

## Section 3: Merge Sequence with Validation Gates

### Merge Order Rationale

```
Phase 0: Fix main build (schema)
  |
Phase 1A: 002 - Scheduling (LOW risk, 0 deletions, foundational for 008)
  |
Phase 1B: 009 - Series/Collections (LOW risk, enhances existing pages)
  |
Phase 2A: 014 - SEO/GEO (MODERATE, editor enhancement, no schema)
  |
Phase 2B: 004 - Batch Ops (MODERATE, cross-cutting UI enhancement)
  |
Phase 2C: 003 - Medium (MODERATE, new integration, isolated)
  |
Phase 2D: 011 - Recommendations (MODERATE, new page, SDK fix needed)
  |
Phase 2E: 008 - AI Calendar Intelligence (MODERATE, depends on 002+011, SDK fix)
  |
Phase 3A: 010 - Social Analytics (HIGH risk, extract only)
  |
Phase 3B: 015 - Evidence Citations (SKIP)
```

---

### Merge 1A: Worktree 002 - Content Scheduling

**Pre-merge Checklist:**
- [ ] Phase 0 complete (build passes)
- [ ] No uncommitted changes on main
- [ ] Schema already has `scheduledPublications` table from Phase 0

**Merge Strategy:** Selective file copy. Copy ONLY source files listed in audit. EXCLUDE `tests/` directory entirely.

**Files to Add:**
```
apps/dashboard/src/app/(dashboard)/[workspace]/calendar/page.tsx
apps/dashboard/src/app/(dashboard)/[workspace]/schedule/page.tsx
apps/dashboard/src/app/api/schedule/route.ts
apps/dashboard/src/app/api/schedule/[id]/route.ts
apps/dashboard/src/app/api/schedule/publish/route.ts
apps/dashboard/src/components/scheduling/calendar-view.tsx
apps/dashboard/src/components/scheduling/publish-queue.tsx
apps/dashboard/src/components/scheduling/recent-activity.tsx
apps/dashboard/src/components/scheduling/schedule-modal.tsx
apps/dashboard/src/hooks/use-schedule.ts
apps/dashboard/src/lib/scheduling/publisher.ts
```

**Files to EXCLUDE:**
```
tests/*
packages/db/migrations/*  (schema handled in Phase 0)
```

**Post-merge Build Verification:**
```bash
cd apps/dashboard && npx next build
# Expected: exit 0, all routes compiled
```

**Dev Server Start:**
```bash
cd apps/dashboard && npx next dev &
# Wait for "Ready in" message
# Kill after validation
```

**Functional Validation Gate:**

| # | PASS Criterion | Playwright Action | Screenshot |
|---|---------------|-------------------|------------|
| 1 | Schedule page loads | `goto('/{workspace}/schedule')` | `002-schedule-page.png` |
| 2 | Publish queue component visible | Assert `[data-testid="publish-queue"]` or heading "Publish Queue" visible | (same) |
| 3 | Calendar page loads | `goto('/{workspace}/calendar')` | `002-calendar-page.png` |
| 4 | Calendar grid renders | Assert month/day grid cells visible | (same) |
| 5 | No console errors | Capture console via `page.on('console')`, filter errors | `002-console-log.txt` |

**Evidence Review Checklist:**
- [ ] Screenshot `002-schedule-page.png` READ -- shows queue UI with heading
- [ ] Screenshot `002-calendar-page.png` READ -- shows month grid
- [ ] Console log reviewed -- ZERO errors
- [ ] Build output quoted with exit code

**Skill Invocations:** `functional-validation`, `gate-validation-discipline`

**Commit Message:** `feat(scheduling): add content scheduling with calendar view and publish queue`

---

### Merge 1B: Worktree 009 - Series & Collections

**Pre-merge Checklist:**
- [ ] Merge 1A complete and validated
- [ ] Build still passes

**Merge Strategy:** Selective file copy. SKIP schema.ts changes (duplicate table defs). Copy new page/component/hook/API files. Apply sidebar modification manually.

**Files to Add:**
```
apps/dashboard/src/app/(dashboard)/[workspace]/series/page.tsx
apps/dashboard/src/app/(dashboard)/[workspace]/series/[seriesId]/page.tsx
apps/dashboard/src/app/(dashboard)/[workspace]/collections/[collectionId]/page.tsx
apps/dashboard/src/app/api/series/route.ts
apps/dashboard/src/app/api/series/[id]/route.ts
apps/dashboard/src/app/api/series/[id]/posts/route.ts
apps/dashboard/src/app/api/collections/[id]/posts/route.ts
apps/dashboard/src/app/api/public/collections/[workspace]/[slug]/route.ts
apps/dashboard/src/components/series/drag-drop-reorder.tsx
apps/dashboard/src/components/series/series-nav-links.tsx
apps/dashboard/src/hooks/use-series.ts
apps/dashboard/src/hooks/use-collections.ts
```

**Files to MODIFY (manual merge):**
```
apps/dashboard/src/app/(dashboard)/[workspace]/collections/page.tsx  -- replace with 009 version
apps/dashboard/src/app/api/collections/route.ts                       -- replace with 009 version
apps/dashboard/src/app/api/collections/[id]/route.ts                 -- replace with 009 version
apps/dashboard/src/app/api/feed/[...slug]/route.ts                   -- merge RSS scoping changes
apps/dashboard/src/components/layout/app-sidebar.tsx                 -- add Series nav link
```

**Sidebar Change (exact):**
Add to `mainNav` array in `app-sidebar.tsx`:
```typescript
{ label: "Series", icon: BookOpen, href: "/series" },
```
Add `BookOpen` to lucide-react imports.

**Files to EXCLUDE:**
```
packages/db/src/schema.ts  (duplicate table defs)
packages/db/migrations/*
```

**Post-merge Build:** `cd apps/dashboard && npx next build` -- expect exit 0.

**Functional Validation Gate:**

| # | PASS Criterion | Playwright Action | Screenshot |
|---|---------------|-------------------|------------|
| 1 | Series page loads | `goto('/{workspace}/series')` | `009-series-list.png` |
| 2 | Create Series UI visible | Assert button "Create Series" or "New Series" | (same) |
| 3 | Series link in sidebar | Assert sidebar contains "Series" link | `009-sidebar.png` |
| 4 | Collections page loads | `goto('/{workspace}/collections')` | `009-collections.png` |
| 5 | Collection detail loads | Navigate to a collection detail | `009-collection-detail.png` |
| 6 | No console errors | Console filter | `009-console-log.txt` |

**Evidence Review Checklist:**
- [ ] Screenshot shows series page with list/empty state
- [ ] Sidebar screenshot shows Series nav item
- [ ] Collections page enhanced with new features
- [ ] ZERO console errors

**Commit Message:** `feat(series): add content series and enhanced collections with drag-drop reorder`

---

### Merge 2A: Worktree 014 - SEO/GEO

**Pre-merge Checklist:**
- [ ] Merge 1B complete and validated
- [ ] Build passes

**Merge Strategy:** Selective file copy. EXCLUDE 4 test files.

**Files to Add:**
```
apps/dashboard/src/app/api/content/[id]/seo/analyze/route.ts
apps/dashboard/src/app/api/content/[id]/seo/generate-meta/route.ts
apps/dashboard/src/components/seo/geo-checklist.tsx
apps/dashboard/src/components/seo/keyword-suggestions.tsx
apps/dashboard/src/components/seo/meta-fields.tsx
apps/dashboard/src/components/seo/readability-score.tsx
apps/dashboard/src/components/seo/seo-panel.tsx
apps/dashboard/src/components/seo/seo-preview.tsx
apps/dashboard/src/hooks/use-seo.ts
apps/dashboard/src/lib/seo/geo-optimizer.ts
apps/dashboard/src/lib/seo/keyword-extractor.ts
apps/dashboard/src/lib/seo/meta-generator.ts
apps/dashboard/src/lib/seo/readability-scorer.ts
apps/dashboard/src/lib/seo/structured-data-generator.ts
```

**Files to EXCLUDE:**
```
apps/dashboard/src/lib/seo/geo-optimizer.test.ts
apps/dashboard/src/lib/seo/keyword-extractor.test.ts
apps/dashboard/src/lib/seo/readability-scorer.test.ts
apps/dashboard/src/lib/seo/structured-data-generator.test.ts
packages/db/migrations/*
```

**Post-merge Build:** expect exit 0.

**Functional Validation Gate:**

| # | PASS Criterion | Playwright Action | Screenshot |
|---|---------------|-------------------|------------|
| 1 | Content editor loads | `goto('/{workspace}/content/[any-post-id]')` | `014-editor.png` |
| 2 | SEO tab accessible | Click "SEO" tab in editor | `014-seo-tab.png` |
| 3 | SEO panel renders | Assert seo-panel component visible | (same) |
| 4 | Readability score shown | Assert numeric score displayed | `014-readability.png` |
| 5 | Keyword suggestions render | Assert keyword section visible | (same) |
| 6 | GEO checklist renders | Assert checklist items visible | `014-geo-checklist.png` |
| 7 | SEO preview renders | Assert Google/social preview cards | `014-seo-preview.png` |
| 8 | No console errors | Console filter | `014-console-log.txt` |

**Commit Message:** `feat(seo): add comprehensive SEO and GEO optimization panel with readability scoring`

---

### Merge 2B: Worktree 004 - Batch Operations

**Pre-merge Checklist:**
- [ ] Merge 2A complete and validated
- [ ] Build passes

**Merge Strategy:** Selective file copy. Add `batchJobs` table to schema.

**Schema Addition:** Add `batchJobs` pgTable to `packages/db/src/schema.ts` (extract from 004 worktree schema).

**Files to Add:**
```
apps/dashboard/src/app/api/sessions/batch/route.ts
apps/dashboard/src/app/api/insights/batch/route.ts
apps/dashboard/src/app/api/posts/batch/route.ts
apps/dashboard/src/app/api/jobs/[jobId]/route.ts
apps/dashboard/src/app/api/jobs/[jobId]/cancel/route.ts
apps/dashboard/src/app/api/jobs/process/route.ts
apps/dashboard/src/components/batch/multi-select-toolbar.tsx
apps/dashboard/src/components/batch/job-progress-modal.tsx
apps/dashboard/src/hooks/use-batch-operations.ts
apps/dashboard/src/hooks/use-job-progress.ts
apps/dashboard/src/lib/queue/batch-processor.ts
apps/dashboard/src/lib/queue/job-tracker.ts
```

**Files to EXCLUDE:**
```
e2e-evidence/*
apps/dashboard/e2e-evidence/*
.auto-claude/specs/*/implementation_plan.json
packages/db/migrations/*
```

**Post-merge Build:** expect exit 0.

**Functional Validation Gate:**

| # | PASS Criterion | Playwright Action | Screenshot |
|---|---------------|-------------------|------------|
| 1 | Sessions page loads | `goto('/{workspace}/sessions')` | `004-sessions.png` |
| 2 | Selection mode available | Check for checkboxes or selection trigger | `004-select-mode.png` |
| 3 | Content page loads | `goto('/{workspace}/content')` | `004-content.png` |
| 4 | Batch toolbar renders on select | Select items, verify toolbar appears | `004-batch-toolbar.png` |
| 5 | No console errors | Console filter | `004-console-log.txt` |

**Commit Message:** `feat(batch): add batch operations with multi-select toolbar and job progress tracking`

---

### Merge 2C: Worktree 003 - Medium Publishing

**Pre-merge Checklist:**
- [ ] Merge 2B complete and validated
- [ ] Build passes

**Merge Strategy:** Selective file copy. Add `mediumIntegrations` and `mediumPublications` tables to schema.

**Schema Additions:**
- `mediumIntegrations` pgTable
- `mediumPublications` pgTable
- Relations for both

**Files to Add:**
```
apps/dashboard/src/app/api/integrations/medium/route.ts
apps/dashboard/src/app/api/integrations/medium/oauth/route.ts
apps/dashboard/src/app/api/integrations/medium/callback/route.ts
apps/dashboard/src/app/api/integrations/medium/publish/route.ts
apps/dashboard/src/components/publishing/medium-publish-modal.tsx
apps/dashboard/src/hooks/use-medium.ts
apps/dashboard/src/lib/integrations/medium.ts
```

**Post-merge Build:** expect exit 0.

**Functional Validation Gate:**

| # | PASS Criterion | Playwright Action | Screenshot |
|---|---------------|-------------------|------------|
| 1 | Integrations page loads | `goto('/{workspace}/settings/integrations')` | `003-integrations.png` |
| 2 | Medium card visible | Assert "Medium" text or logo on page | (same) |
| 3 | Connect button renders | Assert connect/configure button for Medium | `003-medium-card.png` |
| 4 | No console errors | Console filter | `003-console-log.txt` |

**Commit Message:** `feat(medium): add Medium publishing integration with OAuth and publish modal`

---

### Merge 2D: Worktree 011 - Recommendations Engine

**Pre-merge Checklist:**
- [ ] Merge 2C complete and validated
- [ ] Build passes

**Merge Strategy:** Selective file copy + SDK fix.

**CRITICAL PRE-COPY FIX:**
Before copying `recommendations-analyzer.ts`, rewrite it to use `@anthropic-ai/claude-agent-sdk`:
1. Replace `import Anthropic from "@anthropic-ai/sdk"` with `import { query } from "@anthropic-ai/claude-agent-sdk"`
2. Remove `const client = new Anthropic()`
3. Add `delete process.env.CLAUDECODE` before any `query()` call
4. Rewrite tool-use loop to use `query()` instead of `client.messages.create()`

**Schema Additions:**
- `postPerformanceMetrics` pgTable
- `contentRecommendations` pgTable (this is the canonical definition -- 008 will extend)

**Files to Add:**
```
apps/dashboard/src/app/(dashboard)/[workspace]/recommendations/page.tsx
apps/dashboard/src/app/api/recommendations/route.ts
apps/dashboard/src/app/api/recommendations/generate/route.ts
apps/dashboard/src/app/api/recommendations/[id]/rate/route.ts
apps/dashboard/src/app/api/content/[id]/performance/route.ts
apps/dashboard/src/components/recommendations-card.tsx
apps/dashboard/src/hooks/use-recommendations.ts
apps/dashboard/src/lib/ai/agents/recommendations-analyzer.ts  (FIXED)
apps/dashboard/src/lib/ai/prompts/recommendations.ts
apps/dashboard/src/lib/ai/tools/performance-analyzer.ts
```

**Files with CONFLICT RISK:**
- `apps/dashboard/src/app/api/analytics/route.ts` -- check if exists on main. If so, merge carefully. If not, add.

**Sidebar Change:**
Add to `mainNav` in `app-sidebar.tsx`:
```typescript
{ label: "Recommendations", icon: Sparkles, href: "/recommendations" },
```
Add `Sparkles` to lucide-react imports.

**Post-merge Build:** expect exit 0.

**Functional Validation Gate:**

| # | PASS Criterion | Playwright Action | Screenshot |
|---|---------------|-------------------|------------|
| 1 | Recommendations page loads | `goto('/{workspace}/recommendations')` | `011-recommendations.png` |
| 2 | Recommendation cards render | Assert card components visible | (same) |
| 3 | Generate button visible | Assert "Generate" button | `011-generate-btn.png` |
| 4 | Sidebar shows Recommendations | Assert nav item | `011-sidebar.png` |
| 5 | No SDK import errors | Build output shows no `@anthropic-ai/sdk` errors | (build log) |
| 6 | No console errors | Console filter | `011-console-log.txt` |

**Commit Message:** `feat(recommendations): add AI-powered content performance recommendations engine`

---

### Merge 2E: Worktree 008 - AI Calendar Intelligence

**Pre-merge Checklist:**
- [ ] Merge 2D complete (011 recommendations merged)
- [ ] Build passes

**Merge Strategy:** Selective file copy + SDK fix + conflict resolution.

**CRITICAL PRE-COPY FIXES:**
1. Rewrite `content-strategist.ts` -- same SDK fix as 011 (replace `@anthropic-ai/sdk` with `@anthropic-ai/claude-agent-sdk`)
2. Rename `use-recommendations.ts` to `use-calendar-recommendations.ts` (avoids conflict with 011's hook)
3. Rename `recommendation-card.tsx` to `calendar-recommendation-card.tsx`
4. Rename `analytics/route.ts` to `analytics/calendar/route.ts` (avoids conflict with 011's analytics route)

**Schema Additions:**
- `engagementMetrics` pgTable
- `recommendationFeedback` pgTable
- Do NOT add duplicate `contentRecommendations` (already from 011)

**Files to Add (with renames):**
```
apps/dashboard/src/app/api/agents/strategist/route.ts
apps/dashboard/src/app/api/analytics/calendar/route.ts  (RENAMED from analytics/route.ts)
apps/dashboard/src/app/api/content/recommendations/route.ts
apps/dashboard/src/app/api/content/recommendations/[id]/feedback/route.ts
apps/dashboard/src/components/content/calendar-recommendation-card.tsx  (RENAMED)
apps/dashboard/src/hooks/use-calendar-recommendations.ts  (RENAMED)
apps/dashboard/src/lib/ai/agents/content-strategist.ts  (FIXED SDK)
apps/dashboard/src/lib/ai/prompts/content-strategist.ts
apps/dashboard/src/lib/ai/tools/analytics-tools.ts
apps/dashboard/src/lib/ai/tools/recommendation-tools.ts
```

**Internal Reference Updates:**
- In renamed files, update all imports referencing old filenames
- In `calendar-recommendation-card.tsx`, update import of hook to `use-calendar-recommendations`
- In `content-strategist.ts`, update SDK usage pattern

**Post-merge Build:** expect exit 0.

**Functional Validation Gate:**

| # | PASS Criterion | Playwright Action | Screenshot |
|---|---------------|-------------------|------------|
| 1 | Calendar page still works | `goto('/{workspace}/calendar')` | `008-calendar.png` |
| 2 | Recommendations page still works | `goto('/{workspace}/recommendations')` | `008-recommendations-still-works.png` |
| 3 | Strategist API responds | `fetch('/api/agents/strategist')` returns non-500 | (dev tools) |
| 4 | No SDK import errors | Build output clean | (build log) |
| 5 | No console errors | Console filter | `008-console-log.txt` |

**Commit Message:** `feat(calendar-ai): add AI-powered content calendar intelligence with strategist agent`

---

### Merge 3A: Worktree 010 - Social Media Analytics

**Pre-merge Checklist:**
- [ ] All Phase 2 merges complete and validated
- [ ] Build passes

**Merge Strategy: EXTRACT ONLY.** Do NOT run `git merge`. Copy individual files manually from worktree directory.

**Files to Add:**
```
apps/dashboard/src/app/api/analytics/social/route.ts
apps/dashboard/src/app/api/analytics/social/sync/route.ts
apps/dashboard/src/app/api/automation/social-sync/route.ts
apps/dashboard/src/app/api/integrations/twitter/route.ts
apps/dashboard/src/app/api/integrations/twitter/oauth/route.ts
apps/dashboard/src/app/api/integrations/twitter/callback/route.ts
apps/dashboard/src/app/api/integrations/linkedin/route.ts
apps/dashboard/src/app/api/integrations/linkedin/oauth/route.ts
apps/dashboard/src/app/api/integrations/linkedin/callback/route.ts
apps/dashboard/src/components/analytics/metrics-card.tsx
apps/dashboard/src/components/analytics/platform-comparison.tsx
apps/dashboard/src/components/analytics/trend-chart.tsx
apps/dashboard/src/lib/integrations/twitter.ts
apps/dashboard/src/lib/integrations/linkedin.ts
```

**Files to MODIFY:**
- `apps/dashboard/src/app/(dashboard)/[workspace]/analytics/page.tsx` -- merge social analytics section into existing page (do NOT replace entirely)

**Schema Additions:**
- `twitterIntegrations` pgTable
- `linkedinIntegrations` pgTable
- `twitterPublications` pgTable
- `linkedinPublications` pgTable
- `socialAnalytics` pgTable
- Relations for all 5

**Files to EXCLUDE:**
```
.auto-claude/specs/*/implementation_plan.json
packages/db/migrations/*
All files not listed above
```

**Post-merge Build:** expect exit 0.

**Functional Validation Gate:**

| # | PASS Criterion | Playwright Action | Screenshot |
|---|---------------|-------------------|------------|
| 1 | Analytics page loads | `goto('/{workspace}/analytics')` | `010-analytics.png` |
| 2 | Social analytics section visible | Assert social metrics section | `010-social-section.png` |
| 3 | Metrics cards render | Assert metrics-card components | (same) |
| 4 | Trend chart renders | Assert chart component visible | `010-trend-chart.png` |
| 5 | Integrations page shows social | `goto('/{workspace}/settings/integrations')` | `010-social-integrations.png` |
| 6 | No console errors | Console filter | `010-console-log.txt` |

**Commit Message:** `feat(social-analytics): add Twitter/LinkedIn engagement analytics with trend charts`

---

### Merge 3B: Worktree 015 - Evidence Citations

**Decision: SKIP.**

Empty diff against main. Feature is ~40% complete with no extractable code. Would need full reimplementation from spec. Not worth including in this consolidation.

---

## Section 4: Team Coordination Protocol

### Agent Roster

| Agent Name | Role | Responsibilities |
|------------|------|-----------------|
| **lead** | Orchestrator | Sequence control, conflict resolution, sidebar/layout edits, final audit |
| **schema-agent** | Schema Owner | EXCLUSIVE ownership of `packages/db/src/schema.ts`. Phase 0 + all schema additions |
| **merge-agent-1** | Feature Merger | Merges 002, 009, 014 (Phase 1A, 1B, 2A) |
| **merge-agent-2** | Feature Merger | Merges 004, 003 (Phase 2B, 2C) |
| **sdk-fix-agent** | SDK Remediation | Fixes 011 + 008 SDK violations, then hands off to merge-agent |
| **validator** | Validation Agent | Runs Playwright, captures screenshots, reviews evidence, reports PASS/FAIL |

### File Ownership Boundaries

```
schema-agent:
  packages/db/src/schema.ts
  packages/db/src/**

merge-agent-1:
  apps/dashboard/src/app/(dashboard)/[workspace]/calendar/**
  apps/dashboard/src/app/(dashboard)/[workspace]/schedule/**
  apps/dashboard/src/app/(dashboard)/[workspace]/series/**
  apps/dashboard/src/app/(dashboard)/[workspace]/collections/**
  apps/dashboard/src/app/api/schedule/**
  apps/dashboard/src/app/api/series/**
  apps/dashboard/src/app/api/collections/**
  apps/dashboard/src/app/api/public/**
  apps/dashboard/src/app/api/content/[id]/seo/**
  apps/dashboard/src/components/scheduling/**
  apps/dashboard/src/components/series/**
  apps/dashboard/src/components/seo/**
  apps/dashboard/src/hooks/use-schedule.ts
  apps/dashboard/src/hooks/use-series.ts
  apps/dashboard/src/hooks/use-collections.ts
  apps/dashboard/src/hooks/use-seo.ts
  apps/dashboard/src/lib/scheduling/**
  apps/dashboard/src/lib/seo/**

merge-agent-2:
  apps/dashboard/src/app/api/sessions/batch/**
  apps/dashboard/src/app/api/insights/batch/**
  apps/dashboard/src/app/api/posts/batch/**
  apps/dashboard/src/app/api/jobs/**
  apps/dashboard/src/app/api/integrations/medium/**
  apps/dashboard/src/components/batch/**
  apps/dashboard/src/components/publishing/**
  apps/dashboard/src/hooks/use-batch-operations.ts
  apps/dashboard/src/hooks/use-job-progress.ts
  apps/dashboard/src/hooks/use-medium.ts
  apps/dashboard/src/lib/queue/**
  apps/dashboard/src/lib/integrations/medium.ts

sdk-fix-agent:
  apps/dashboard/src/lib/ai/agents/recommendations-analyzer.ts
  apps/dashboard/src/lib/ai/agents/content-strategist.ts

lead (shared files -- ONLY lead touches these):
  apps/dashboard/src/components/layout/app-sidebar.tsx
  apps/dashboard/src/app/(dashboard)/[workspace]/analytics/page.tsx
  apps/dashboard/src/app/api/analytics/route.ts

validator:
  READ-ONLY access to all files
  WRITE access to evidence/ directory only
```

### Port 3000 Rotation

Only ONE agent runs the dev server at a time. Sequence:

```
Phase 0: schema-agent runs build only (no dev server)
Phase 1A: merge-agent-1 copies files -> schema-agent signals done -> validator starts dev server, validates, kills
Phase 1B: merge-agent-1 copies files -> validator starts dev server, validates, kills
Phase 2A: merge-agent-1 copies files -> validator starts dev server, validates, kills
Phase 2B: merge-agent-2 copies files -> validator starts dev server, validates, kills
Phase 2C: merge-agent-2 copies files -> validator starts dev server, validates, kills
Phase 2D: sdk-fix-agent fixes -> merge-agent-2 copies -> validator starts dev server, validates, kills
Phase 2E: sdk-fix-agent fixes -> lead merges -> validator starts dev server, validates, kills
Phase 3A: lead extracts files -> validator starts dev server, validates, kills
Final: validator runs comprehensive audit
```

**Rule:** Before starting dev server, run `lsof -i :3000` to verify port is free. Kill any zombie process.

### Playwright Browser Rotation

Only ONE agent uses Playwright at a time: the **validator** agent. No other agent should launch a browser.

**Validator Protocol:**
1. Wait for merge-agent to signal "files copied + build passes"
2. Start dev server: `cd apps/dashboard && npx next dev`
3. Wait for "Ready in" message
4. Run Playwright validation sequence
5. Capture screenshots to `evidence/{phase}/`
6. Kill dev server
7. Report PASS/FAIL with evidence citations

### Schema Ownership Protocol

**schema-agent** is the ONLY agent allowed to edit `packages/db/src/schema.ts`.

When a merge-agent needs schema changes:
1. Merge-agent sends schema change request to lead (table definition + relations)
2. Lead forwards to schema-agent
3. Schema-agent applies change, runs build verification
4. Schema-agent signals completion
5. Merge-agent proceeds with file copy

### Communication Protocol

```
merge-agent -> lead:     "Phase 1A files copied. Ready for build + validation."
lead -> validator:        "Run Phase 1A validation."
validator -> lead:        "Phase 1A PASS. Evidence: 002-schedule-page.png shows queue UI."
lead -> merge-agent:      "Phase 1A validated. Proceed to 1B."
merge-agent -> lead:      "Need schema change for Phase 2B: batchJobs table."
lead -> schema-agent:     "Add batchJobs table. Definition: [...]"
schema-agent -> lead:     "batchJobs added. Build passes."
lead -> merge-agent:      "Schema updated. Proceed."
```

### Conflict Resolution

1. **Same file conflict:** Lead resolves. Only lead edits shared files.
2. **Schema conflict:** schema-agent reconciles (e.g., 008 vs 011 contentRecommendations).
3. **Build failure after merge:** Merge-agent reverts their files, investigates, fixes, re-copies.
4. **Validation failure:** Validator reports specific failure. Merge-agent fixes. Re-validate.

---

## Section 5: Full Application Audit

### Every Screen in the Application

After all merges complete, audit every screen. This is the screen-by-screen list with navigation paths and PASS criteria.

#### Existing Screens (Pre-Merge)

| # | Screen | Navigation Path | Expected Content | PASS Criteria |
|---|--------|----------------|------------------|---------------|
| 1 | Dashboard | `/{workspace}` | Overview stats, recent activity | Stats cards render, no errors |
| 2 | Sessions List | `/{workspace}/sessions` | List of Claude sessions | Session cards render, pagination works |
| 3 | Session Detail | `/{workspace}/sessions/[id]` | Session transcript, metadata | Transcript loads, insight extraction visible |
| 4 | Insights List | `/{workspace}/insights` | List of extracted insights | Insight cards render with scores |
| 5 | Insight Detail | `/{workspace}/insights/[id]` | Full insight with source session | Insight content renders, source link works |
| 6 | Content List | `/{workspace}/content` | List of posts (blog, twitter, linkedin) | Post cards render with status badges |
| 7 | Content Editor | `/{workspace}/content/[id]` | Lexical editor with tabs | Editor loads, all tabs accessible |
| 8 | New Content | `/{workspace}/content/new` | Content creation form | Form fields render (topic, perspective, URLs) |
| 9 | Analytics | `/{workspace}/analytics` | Performance metrics | Charts and metrics render |
| 10 | Collections | `/{workspace}/collections` | Collection list | Collections render, create button works |
| 11 | Collection Detail | `/{workspace}/collections/[id]` | Posts in collection | Post list renders |
| 12 | Automation | `/{workspace}/automation` | Automation rules | Rules list renders |
| 13 | Settings | `/{workspace}/settings` | General settings | Settings form renders |
| 14 | Style Settings | `/{workspace}/settings/style` | Writing style config | Style options render |
| 15 | API Keys | `/{workspace}/settings/api-keys` | API key management | Key list renders |
| 16 | Integrations | `/{workspace}/settings/integrations` | Platform connections | Integration cards render |
| 17 | Skills | `/{workspace}/settings/skills` | Writing skills config | Skills list renders |
| 18 | Webhooks | `/{workspace}/settings/webhooks` | Webhook endpoints | Webhook list renders |
| 19 | WordPress | `/{workspace}/settings/wordpress` | WordPress connection | Connection form renders |

#### New Screens (Post-Merge)

| # | Screen | Source | Navigation Path | Expected Content | PASS Criteria |
|---|--------|--------|----------------|------------------|---------------|
| 20 | Schedule | 002 | `/{workspace}/schedule` | Publish queue | Queue list renders, schedule modal opens |
| 21 | Calendar | 002 | `/{workspace}/calendar` | Calendar grid | Month view with day cells, scheduled items |
| 22 | Series List | 009 | `/{workspace}/series` | Series listing | Series cards, create button |
| 23 | Series Detail | 009 | `/{workspace}/series/[id]` | Ordered post list | Posts with drag-drop, prev/next nav |
| 24 | Collection Detail (enhanced) | 009 | `/{workspace}/collections/[id]` | Enhanced post list | Public URL toggle, cover image |
| 25 | Recommendations | 011 | `/{workspace}/recommendations` | AI recommendations | Recommendation cards, generate button |

#### Enhanced Screens (Post-Merge)

| # | Screen | Source | What Changed | PASS Criteria |
|---|--------|--------|-------------|---------------|
| 26 | Content Editor - SEO Tab | 014 | Full SEO/GEO panel | Readability score, keywords, GEO checklist, previews |
| 27 | Sessions - Batch | 004 | Multi-select + toolbar | Checkboxes, batch action toolbar |
| 28 | Content - Batch | 004 | Multi-select + toolbar | Checkboxes, batch action toolbar |
| 29 | Insights - Batch | 004 | Multi-select + toolbar | Checkboxes, batch action toolbar |
| 30 | Integrations - Medium | 003 | Medium card | Connect button, Medium section |
| 31 | Analytics - Social | 010 | Social metrics section | Twitter/LinkedIn metrics, trend charts |
| 32 | Integrations - Social | 010 | Twitter/LinkedIn cards | Connect buttons for Twitter, LinkedIn |
| 33 | Calendar - AI | 008 | AI recommendations | Recommendation cards in calendar |

### Polish Items to Check Per Screen

For EVERY screen above:
- [ ] Page title renders correctly
- [ ] Layout is consistent (sidebar visible, content area properly sized)
- [ ] Loading states display (skeleton/spinner) before data loads
- [ ] Empty states display when no data (not blank white page)
- [ ] Error states handle gracefully (no unhandled exceptions)
- [ ] Responsive layout at 1024px width minimum
- [ ] No overlapping elements
- [ ] No truncated text without ellipsis
- [ ] All buttons have hover states
- [ ] All links navigate correctly
- [ ] No horizontal scrollbar on desktop viewport
- [ ] Console shows ZERO errors

### Screenshot Evidence Requirements

Capture ONE screenshot per screen (33 total minimum):
```
evidence/audit/01-dashboard.png
evidence/audit/02-sessions-list.png
evidence/audit/03-session-detail.png
...
evidence/audit/33-calendar-ai.png
```

Each screenshot must be READ by the validator and described in the evidence report:
```
"Viewed evidence/audit/20-schedule.png -- shows publish queue with
'Schedule' heading, empty state message 'No scheduled publications',
and 'Schedule New' button in top right. No console errors visible."
```

---

## Section 6: Final Validation Gate

### Complete Feature Inventory

After all merges, the application must have these features working:

| # | Feature | Source | Evidence Required |
|---|---------|--------|-------------------|
| 1 | User auth (login/logout) | Existing | Screenshot of login + dashboard |
| 2 | Session list + detail | Existing | Screenshot of sessions page |
| 3 | Insight extraction | Existing | Screenshot of insights page |
| 4 | Content creation + editor | Existing | Screenshot of editor with all tabs |
| 5 | Lexical rich text editing | Existing | Screenshot of editor with formatted text |
| 6 | AI Chat in editor | Existing | Screenshot of chat panel |
| 7 | Content publishing (Hashnode) | Existing | Screenshot of publish dropdown |
| 8 | Dev.to integration | Existing | Screenshot of integrations page |
| 9 | WordPress integration | Existing | Screenshot of WordPress settings |
| 10 | Ghost integration | Existing | Screenshot of integrations page |
| 11 | GitHub integration | Existing | Screenshot of integrations page |
| 12 | Analytics dashboard | Existing | Screenshot of analytics page |
| 13 | Collections | Existing+009 | Screenshot of enhanced collections |
| 14 | Automation rules | Existing | Screenshot of automation page |
| 15 | Content templates | Existing | Screenshot via editor |
| 16 | API key management | Existing | Screenshot of API keys page |
| 17 | Webhook management | Existing | Screenshot of webhooks page |
| 18 | Writing style config | Existing | Screenshot of style settings |
| 19 | **Content scheduling** | 002 | Screenshot of schedule page + calendar |
| 20 | **Publish queue** | 002 | Screenshot of queue with items or empty state |
| 21 | **Content series** | 009 | Screenshot of series list + detail |
| 22 | **Series nav links** | 009 | Screenshot of prev/next in series detail |
| 23 | **Drag-drop reorder** | 009 | Screenshot of reorder UI |
| 24 | **SEO panel** | 014 | Screenshot of full SEO panel in editor |
| 25 | **Readability scoring** | 014 | Screenshot showing score number |
| 26 | **GEO checklist** | 014 | Screenshot of checklist items |
| 27 | **Keyword suggestions** | 014 | Screenshot of keyword section |
| 28 | **SEO preview** | 014 | Screenshot of Google/social previews |
| 29 | **Batch operations** | 004 | Screenshot of multi-select + toolbar |
| 30 | **Job progress** | 004 | Screenshot of progress modal (or component) |
| 31 | **Medium integration** | 003 | Screenshot of Medium on integrations page |
| 32 | **Recommendations page** | 011 | Screenshot of recommendations |
| 33 | **AI calendar intelligence** | 008 | Screenshot of calendar with AI section |
| 34 | **Social analytics** | 010 | Screenshot of social metrics on analytics |
| 35 | **Twitter integration** | 010 | Screenshot on integrations page |
| 36 | **LinkedIn integration** | 010 | Screenshot on integrations page |
| 37 | **Trend charts** | 010 | Screenshot of trend chart component |

### Evidence Requirements

For EACH feature above:
- [ ] Screenshot captured and saved to `evidence/final/`
- [ ] Screenshot personally READ by validator
- [ ] Screenshot described with specific visible elements
- [ ] No console errors on the page
- [ ] Page loads in under 5 seconds

### The Comprehensive Validation Pass

This is the "one massive long line" final walkthrough. The validator agent must:

1. Start dev server on port 3000
2. Open browser via Playwright MCP
3. Log in to the application
4. Navigate through EVERY screen in sequence (33+ pages)
5. On each screen:
   - Wait for full load (no skeleton/spinner)
   - Capture screenshot
   - Check console for errors
   - Verify key elements visible
   - Note any visual issues
6. Generate final report with:
   - Total screens visited: X
   - Screens PASSED: X
   - Screens FAILED: X (with details)
   - Console errors found: X
   - Visual issues found: X
   - Overall verdict: PASS / FAIL

### Acceptance Criteria for FINAL PASS

ALL of these must be true:
- [ ] `npx next build` exits 0 with all routes compiled
- [ ] Dev server starts without errors
- [ ] ALL 33+ screens load without 500 errors
- [ ] ZERO console errors across all pages
- [ ] All new nav items appear in sidebar (Series, Schedule, Calendar, Recommendations)
- [ ] All new pages render content (not blank)
- [ ] All editor tabs functional (including new SEO panel)
- [ ] All integration cards visible on integrations page
- [ ] No broken images or missing icons
- [ ] No TypeScript build errors
- [ ] All screenshots captured and reviewed

### Skills to Invoke

Throughout execution, these skills MUST be invoked at the specified phases:

| Skill | When | Purpose |
|-------|------|---------|
| `functional-validation` | Before each validation gate | Full validation protocol |
| `gate-validation-discipline` | At every PASS/FAIL decision | Evidence-based verification |
| `create-validation-plan` | Before final audit | Structured validation planning |
| `full-functional-audit` | During Section 5 audit | Complete app audit |

---

## Appendix A: Sidebar Navigation (Final State)

After all merges, `app-sidebar.tsx` mainNav should be:

```typescript
const mainNav = [
  { label: "Dashboard", icon: LayoutDashboard, href: "" },
  { label: "Sessions", icon: ScrollText, href: "/sessions" },
  { label: "Insights", icon: Lightbulb, href: "/insights" },
  { label: "Content", icon: FileText, href: "/content" },
  { label: "Series", icon: BookOpen, href: "/series" },        // NEW (009)
  { label: "Calendar", icon: CalendarDays, href: "/calendar" }, // NEW (002)
  { label: "Schedule", icon: Clock, href: "/schedule" },        // NEW (002)
  { label: "Recommendations", icon: Sparkles, href: "/recommendations" }, // NEW (011)
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Collections", icon: FolderOpen, href: "/collections" },
  { label: "Automation", icon: Zap, href: "/automation" },
];
```

New imports needed: `BookOpen`, `CalendarDays`, `Clock`, `Sparkles` from `lucide-react`.

---

## Appendix B: Schema Table Count (Final State)

After all merges, `packages/db/src/schema.ts` should have ~57 pgTable exports:

```
Existing (30):
  users, authSessions, accounts, verifications, workspaces, styleSettings,
  claudeSessions, insights, posts, contentTriggers, apiKeys, workspaceMembers,
  workspaceInvites, workspaceActivity, collections, collectionPosts, series,
  seriesPosts, devtoIntegrations, devtoPublications, ghostIntegrations,
  ghostPublications, githubIntegrations, githubRepositories, githubCommits,
  githubPullRequests, githubIssues, githubPrivacySettings, contentTemplates,
  supplementaryContent

Phase 0 (16 restored):
  integrationSettings, sessionBookmarks, contentMetrics, platformSettings,
  postRevisions, webhookEndpoints, scheduledPublications, agentRuns,
  writingSkills, automationRuns, wordpressConnections, postConversations,
  subscriptions, usageEvents, usageMonthlySummary, contentAssets

Phase 2B (1 new):
  batchJobs

Phase 2C (2 new):
  mediumIntegrations, mediumPublications

Phase 2D (2 new):
  postPerformanceMetrics, contentRecommendations

Phase 2E (2 new):
  engagementMetrics, recommendationFeedback

Phase 3A (5 new):
  twitterIntegrations, linkedinIntegrations, twitterPublications,
  linkedinPublications, socialAnalytics

TOTAL: 58 tables
```

---

## Appendix C: Worktree Cleanup

After successful merge + validation of each worktree:

```bash
# Remove worktree
git worktree remove .auto-claude/worktrees/tasks/{branch-name}

# Delete local branch
git branch -d auto-claude/{branch-name}
```

Order of cleanup follows merge order. Only clean up AFTER validation PASSES.

---

## Unresolved Questions

1. **Analytics route conflict:** Both 011 and existing main may have `apps/dashboard/src/app/api/analytics/route.ts`. Need to verify at merge time whether main already has this route and how to reconcile.

2. **009 merge conflicts:** The 12 unmerged files with conflicts need manual inspection at merge time. Selective file copy avoids the git merge conflicts, but the modifications to `feed/[...slug]/route.ts` (RSS scoping) need careful manual merge.

3. **Database sync:** After adding tables to schema, `drizzle-kit push` may be needed to sync live DB. However, drizzle-kit hangs on interactive prompts for new enums. Plan to use direct SQL `ALTER TABLE` statements as fallback. Need to verify which tables already exist in live DB (reported as 45 tables) vs which are new.

4. **Medium OAuth env vars:** MEDIUM_CLIENT_ID and MEDIUM_CLIENT_SECRET won't be set in dev. Need to verify the integration page handles missing env vars gracefully (shows "not configured" rather than crashing).

5. **008's dependency on 002 calendar:** The AI calendar intelligence features assume the calendar page from 002 exists. If 002's calendar page structure changes during merge, 008's integration points may need adjustment.

6. **Batch operations integration with pages:** 004's multi-select toolbar needs to be wired into existing sessions/insights/content list pages. The worktree may have modified those pages, but since we're doing selective file copy, we might miss those integrations. Need to check if 004 modifies the list page components or if the toolbar is a standalone overlay.
