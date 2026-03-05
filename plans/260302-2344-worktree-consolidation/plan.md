# Worktree Consolidation Plan — 21 Branches → Main

**Date:** 2026-03-02
**Branch:** main (0101cc8)
**Schema baseline:** 637 lines in `packages/db/src/schema.ts`
**Strategy:** Sequential merge with validation gates after each merge

---

## Risk Analysis

### Schema.ts Conflict Matrix (15/21 branches modify it)
| Branch | Schema Lines Added | Risk |
|--------|-------------------|------|
| 026 (calendar) | +238 | CRITICAL |
| 035 (billing) | +120 | HIGH |
| 018 (analytics) | +78 | HIGH |
| 020 (style learning) | +64 | MEDIUM |
| 013 (automation) | +58 | MEDIUM |
| 027 (revision history) | +51 | MEDIUM |
| 004 (error recovery) | +41 | MEDIUM |
| 019 (transcript viewer) | +39 | MEDIUM |
| 021 (skill loader) | +34 | LOW |
| 009 (hashnode) | +30 | LOW |
| 031 (public API) | +30 | LOW |
| 034 (wordpress) | +30 | LOW |
| 025 (SEO) | +22 | LOW |
| 024 (repurposing) | +14 | LOW |
| 001 (onboarding) | +1 | TRIVIAL |

### Shared File Hotspots
| File | Branches Touching It |
|------|---------------------|
| `content/[postId]/page.tsx` | 003, 009, 024, 025, 026, 027, 032 |
| `app-sidebar.tsx` | 018, 021, 026, 029, 031, 032, 034 |
| `use-content.ts` | 025, 026, 027, 029, 034 |
| `blog-writer.ts` | 004, 020, 021, 024 |
| `social-writer.ts` | 004, 020, 021 |
| `post-manager.ts` | 006, 020, 024, 026, 027, 031 |

---

## Merge Order (6 Tiers, 21 Branches)

### Principle
1. Zero-schema, zero-overlap branches first (safest)
2. Zero-schema, broader changes next
3. Small schema additions with isolated features
4. Medium schema with core enhancements
5. Large schema with complex integrations
6. Massive schema changers last

---

## TIER 1 — Zero Schema, Minimal Overlap (Safest)

### Merge #1: `010-social-media-copy-platform-specific-formatting`
- **What:** Twitter thread parser + LinkedIn post parser
- **Files:** 2 NEW files only (`lib/social/twitter-parser.ts`, `lib/social/linkedin-parser.ts`)
- **Schema:** None
- **Conflict risk:** ZERO — purely additive, no existing file touched
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Import parsers in REPL — verify exports exist
  - [ ] All existing pages still render (/, /sessions, /content, /insights)

### Merge #2: `032-dark-mode-keyboard-shortcuts`
- **What:** Theme toggle, keyboard shortcuts (Cmd+S, Cmd+/, Cmd+Shift+P), shortcuts modal
- **Files:** 12 files — new hooks, components, providers modification
- **Schema:** None
- **Conflict risk:** LOW — touches `app-sidebar.tsx`, `workspace-shell.tsx`, `ai-chat-sidebar.tsx`
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Dark mode toggle visible in sidebar
  - [ ] Cmd+/ opens shortcuts modal
  - [ ] Theme persists across page refresh

### Merge #3: `003-content-preview-formatting-preview`
- **What:** Blog post preview, LinkedIn preview, Twitter thread preview components + view mode toggle
- **Files:** 7 files — new preview components, `[postId]/page.tsx` modification
- **Schema:** None
- **Conflict risk:** LOW — touches `[postId]/page.tsx` (first touch, clean base)
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Content editor shows Edit/Preview toggle
  - [ ] Blog preview renders markdown correctly
  - [ ] Platform-specific previews (LinkedIn, Twitter) render

---

## TIER 2 — Zero Schema, Broader Changes

### Merge #4: `006-centralized-error-handling-input-validation`
- **What:** `withApiHandler` wrapper, `ApiError` class, Zod validation schemas, error boundaries
- **Files:** 33 files — wraps ALL existing API routes, adds `lib/errors.ts`, `lib/validation.ts`
- **Schema:** None
- **Conflict risk:** MEDIUM — touches nearly every API route file (wrapping, not rewriting)
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] API routes return proper 4xx/5xx JSON error format
  - [ ] Invalid input returns 400 with field-level errors
  - [ ] Error boundary renders on frontend errors
  - [ ] All existing features still work (content CRUD, sessions, insights)

### Merge #5: `029-global-search-content-filtering`
- **What:** Global search modal (Cmd+K), filter params hook, enhanced list APIs with filtering
- **Files:** 15 files — new search components, filter hooks, API query param support
- **Schema:** None
- **Conflict risk:** MEDIUM — touches `app-sidebar.tsx` (already modified by 032), content/sessions/insights pages
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Cmd+K opens global search modal
  - [ ] Search returns results from sessions, content, insights
  - [ ] Content page filters work (status tabs)
  - [ ] Sessions page filters work (date range, message count)

### Merge #6: `022-test-suite-ci-cd-pipeline`
- **What:** Vitest unit tests, Playwright e2e tests, CI config, test fixtures
- **Files:** 24 files — test infrastructure, `.eslintrc.json`, `turbo.json`
- **Schema:** None
- **Conflict risk:** LOW — mostly new files, touches `package.json`, login/signup pages
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] `bun run test` (vitest) — all unit tests pass
  - [ ] Playwright config valid (can run `npx playwright test --list`)
  - [ ] Login page still renders
  - [ ] Turbo pipeline includes test task

---

## TIER 3 — Small Schema, Isolated Features

### Merge #7: `001-onboarding-wizard-first-run-experience`
- **What:** Onboarding wizard (4 steps), welcome modal, `onboardingCompleted` field, `/onboarding` route
- **Files:** 21 files — new route group `(onboarding)`, components, API route, migration
- **Schema:** +1 line (adds `onboardingCompleted` to workspaces table)
- **Conflict risk:** LOW — touches dashboard pages (banner injection) but minimal code changes
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Schema migration applies cleanly
  - [ ] `/onboarding` page renders with 4-step wizard
  - [ ] Dashboard shows "Resume Setup" banner for incomplete onboarding
  - [ ] Completing wizard sets `onboardingCompleted = true`

### Merge #8: `004-error-recovery-agent-retry-logic`
- **What:** `agentRuns` table, retry logic with exponential backoff, SSE retry events, run logging
- **Files:** 10 files — agent files enhanced, new retry orchestration, agent status UI
- **Schema:** +41 lines (new `agentRuns` table + enum)
- **Conflict risk:** MEDIUM — modifies all 4 AI agents (blog-writer, social-writer, changelog-writer, insight-extractor)
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] `agentRuns` table created in DB
  - [ ] Agent execution creates run record
  - [ ] Failed agent shows retry status in UI
  - [ ] Retry respects max attempts and backoff

### Merge #9: `009-hashnode-publishing-integration`
- **What:** Hashnode API client, publish modal, integration settings, `hashnodeIntegrations` table
- **Files:** 14 files — new publishing lib, modal, API routes, settings page update
- **Schema:** +30 lines (new table + fields)
- **Conflict risk:** MEDIUM — touches `[postId]/page.tsx` (3rd touch), integrations settings page
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Schema migration applies cleanly
  - [ ] Hashnode integration appears on integrations settings page
  - [ ] Publish-to-Hashnode button appears in content editor
  - [ ] Connection test API works with valid Hashnode token

### Merge #10: `021-skill-loader-ui-custom-writing-skills`
- **What:** Writing skills CRUD, built-in skills library, skill injection into agents, settings page
- **Files:** 12 files — new skills API, settings page, agent modifications
- **Schema:** +34 lines (new `writingSkills` table)
- **Conflict risk:** MEDIUM — modifies blog-writer, changelog-writer, social-writer (already modified by 004)
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Skills settings page renders at `/settings/skills`
  - [ ] Built-in skills list displays
  - [ ] Custom skill CRUD works (create, edit, delete)
  - [ ] Agent uses loaded skills in generation

---

## TIER 4 — Medium Schema, Core Enhancements

### Merge #11: `025-seo-optimization-meta-tag-toolkit`
- **What:** SEO scoring engine, readability analysis, frontmatter generator, SEO panel in editor
- **Files:** 11 files — new `lib/seo/` module, editor panel, API route
- **Schema:** +22 lines (SEO fields on posts table)
- **Conflict risk:** MEDIUM — touches `[postId]/page.tsx` (4th touch), `use-content.ts`
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] SEO panel visible in content editor
  - [ ] SEO score calculates for existing content
  - [ ] Readability metrics display
  - [ ] Frontmatter generation works

### Merge #12: `024-one-click-multi-format-content-repurposing`
- **What:** Repurpose writer agent, "Generate All Formats" button, model selector improvements
- **Files:** 13 files — new repurpose agent, prompts, editor dropdown
- **Schema:** +14 lines (format tracking fields)
- **Conflict risk:** MEDIUM — touches `[postId]/page.tsx` (5th touch), `blog-writer.ts`, `post-manager.ts`
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] "Repurpose" dropdown appears in content editor
  - [ ] "Generate All Formats" works from insight detail page
  - [ ] Repurpose API endpoint responds correctly
  - [ ] Generated formats appear as new content items

### Merge #13: `020-writing-style-learning-voice-consistency`
- **What:** Style learner agent, voice profile generation, profile injection into all writers, edit distance tracking
- **Files:** 15 files — new `lib/style/` module, style learner agent, profile card component
- **Schema:** +64 lines (new `styleProfiles` table + style fields)
- **Conflict risk:** HIGH — modifies all 4 AI agents (already modified by 004, 021), `post-manager.ts`, style settings page
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Style settings page shows "Learned Voice Profile" section
  - [ ] Generate profile API creates style analysis
  - [ ] Profile card displays tone, vocabulary, patterns
  - [ ] AI agents receive style injection in prompts

### Merge #14: `019-session-transcript-deep-viewer`
- **What:** Rich transcript viewer with code blocks, diff blocks, tool call blocks, timeline scrubber, bookmarks
- **Files:** 23 files — new transcript components, bookmark API, enhanced session detail page
- **Schema:** +39 lines (new `sessionBookmarks` table + message fields)
- **Conflict risk:** MEDIUM — new `/sessions/[sessionId]/page.tsx`, modifies `use-sessions.ts`, messages API
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Session detail page shows rich transcript
  - [ ] Code blocks render with syntax highlighting
  - [ ] Tool calls expand/collapse
  - [ ] Timeline scrubber navigates messages
  - [ ] Bookmark CRUD works

---

## TIER 5 — Large Schema, Complex Integrations

### Merge #15: `013-working-automation-pipeline`
- **What:** Automation execution engine, pipeline orchestration, run tracking, UI overhaul
- **Files:** 13 files — pipeline engine, execution API, automation page update
- **Schema:** +58 lines (automation runs table, trigger enhancements)
- **Conflict risk:** HIGH — modifies automation page (already exists), execution route (modified by 006)
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Automation page shows trigger list
  - [ ] Execute trigger creates automation run
  - [ ] Run status tracks through pipeline stages
  - [ ] Run history displays with status indicators

### Merge #16: `018-content-performance-analytics-dashboard`
- **What:** Analytics dashboard page, platform metrics sync, chart components, redis caching
- **Files:** 12 files — new analytics page, API routes, hooks, redis client
- **Schema:** +78 lines (new `platformMetrics`, `analyticsSettings` tables)
- **Conflict risk:** HIGH — new route, modifies `app-sidebar.tsx` (already modified 3x), `mobile-bottom-nav.tsx`
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Analytics page appears in sidebar nav
  - [ ] Metrics API returns data (or empty state)
  - [ ] Platform settings page configures API keys
  - [ ] Charts render (even with empty data)

### Merge #17: `027-content-revision-history-version-tracking`
- **What:** Post revision tracking, diff viewer, restore functionality, revision history panel
- **Files:** 18 files — revision CRUD API, diff viewer, history panel, migration scripts
- **Schema:** +51 lines (new `postRevisions` table)
- **Conflict risk:** HIGH — touches `[postId]/page.tsx` (6th touch), `use-content.ts`, `post-manager.ts`, content API
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Revision history panel visible in content editor
  - [ ] Editing content creates new revision
  - [ ] Diff viewer shows changes between revisions
  - [ ] Restore button reverts to selected revision
  - [ ] Migration script runs successfully

### Merge #18: `031-public-rest-api-webhook-events`
- **What:** Public v1 REST API, API key auth, webhook delivery system, OpenAPI spec, webhooks settings
- **Files:** 25 files — new `/api/v1/` routes, webhook system, API auth middleware
- **Schema:** +30 lines (new `webhooks` table, API key enhancements)
- **Conflict risk:** HIGH — touches `app-sidebar.tsx`, `insight-extractor.ts`, `pipeline.ts` (all modified earlier)
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] `/api/v1/openapi.json` returns valid OpenAPI spec
  - [ ] v1 API endpoints require API key auth
  - [ ] Webhook settings page renders
  - [ ] Webhook CRUD works
  - [ ] Webhook delivery fires on events

### Merge #19: `034-wordpress-publishing-integration`
- **What:** WordPress REST API client, encrypted credential storage, settings page, publish flow
- **Files:** 18 files — new wordpress lib, crypto utils, settings page, publish API
- **Schema:** +30 lines (new `wordpressIntegrations` table)
- **Conflict risk:** MEDIUM — touches `app-sidebar.tsx`, `use-content.ts`
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] WordPress settings page renders at `/settings/wordpress`
  - [ ] Connection test API validates WordPress credentials
  - [ ] Publish-to-WordPress flow works from editor
  - [ ] Credentials stored encrypted

### Merge #20: `035-free-tier-usage-metering-dashboard`
- **What:** Usage tracking, Stripe integration, billing portal, subscription management, metering
- **Files:** 17 files — billing APIs, Stripe webhook, usage tracking, plan definitions
- **Schema:** +120 lines (new `subscriptions`, `usageRecords`, `usageLimits` tables)
- **Conflict risk:** HIGH — modifies agent routes (adding metering checks), scan route
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Usage API returns current usage stats
  - [ ] Billing checkout creates Stripe session (or mock)
  - [ ] Subscription status displays correctly
  - [ ] Agent routes check usage limits before execution

---

## TIER 6 — Massive Schema, Highest Risk

### Merge #21: `026-content-calendar-pipeline-visualization`
- **What:** Calendar view, pipeline kanban, authenticity badges, content streak, RSS feeds, newsletter writer, DevTo improvements
- **Files:** 39 files — massive feature set touching content, publishing, sidebar, mobile nav
- **Schema:** +238 lines (calendar fields, badge config, streak tracking, newsletter tables)
- **Conflict risk:** CRITICAL — touches almost every shared file, includes its own full migration
- **Validation gate:**
  - [ ] `bun run build` passes
  - [ ] Calendar view renders on content page
  - [ ] Pipeline/kanban view shows content stages
  - [ ] Authenticity badge generates for posts
  - [ ] Content streak calculates correctly
  - [ ] RSS feed endpoint works
  - [ ] Newsletter writer agent generates content
  - [ ] DevTo publish modal works
  - [ ] Mobile bottom nav updated correctly

---

## Post-Consolidation Validation

After all 21 merges:
- [ ] Full `bun run build` — zero errors
- [ ] All navigation items present in sidebar
- [ ] Every page renders without errors
- [ ] All API routes respond (health check all endpoints)
- [ ] Database schema matches code expectations
- [ ] Dark mode works across all pages
- [ ] Keyboard shortcuts work
- [ ] Search (Cmd+K) finds content across all new features

---

## Execution Approach

**Per merge, the agent will:**
1. Read the branch's actual code changes in the worktree
2. Attempt `git merge auto-claude/<branch> --no-commit` on main
3. Resolve any conflicts (schema.ts is the primary target)
4. Run `bun run build` to validate
5. Start dev server, hit key pages via API/browser
6. Capture evidence of working features
7. Commit the merge
8. Report validation gate results
9. Move to next merge

**If a merge fails validation:** Stop, document the failure, ask for guidance before continuing.

---

## Summary

| Tier | Branches | Schema Risk | Est. Conflict Work |
|------|----------|------------|-------------------|
| 1 | 010, 032, 003 | None | Trivial |
| 2 | 006, 029, 022 | None | Low-Medium |
| 3 | 001, 004, 009, 021 | Low | Medium |
| 4 | 025, 024, 020, 019 | Medium | Medium-High |
| 5 | 013, 018, 027, 031, 034, 035 | High | High |
| 6 | 026 | Critical | Very High |
