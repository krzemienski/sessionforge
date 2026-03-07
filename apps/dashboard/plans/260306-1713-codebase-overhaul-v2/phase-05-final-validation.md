# Phase 05 — Final Validation

**Priority:** HIGH
**Status:** NOT STARTED
**Effort:** Small (1-2 hours)

---

## Context

After all consolidation work is complete (Phases 01-04), validate the entire dashboard end-to-end. Every gate requires Playwright navigation, screenshot capture, and cited evidence.

This phase exists to catch anything missed in per-phase validation gates.

## Full Validation Checklist

### Gate 1: Navigation Structure

- [ ] Sidebar shows exactly 7 items: Dashboard, Sessions, Insights, Content, Analytics, Automation, Settings
- [ ] All 7 nav items navigate to correct pages (click each, verify URL)
- [ ] No broken nav links
- [ ] No 404 pages reachable from sidebar

### Gate 2: Content Page (Series + Collections)

- [ ] Content page loads with Calendar/Pipeline/List views
- [ ] Series filter visible and functional
- [ ] Collections filter visible and functional
- [ ] "Manage Series" dialog opens with CRUD functionality
- [ ] "Manage Collections" dialog opens with CRUD functionality
- [ ] Pipeline status line visible ("Last pipeline: ..." or empty state)

### Gate 3: Insights Page (Recommendations)

- [ ] Insights list loads with category filters and score slider
- [ ] "Suggested Topics" section visible at top
- [ ] Accept/Dismiss buttons functional on recommendation cards
- [ ] Flow banner still present ("X insights available. Generate Content")

### Gate 4: Settings Page (Tabs)

- [ ] Tab navigation with 5 tabs: General, Style, API Keys, Integrations, Webhooks
- [ ] General: workspace name, slug, scan paths
- [ ] Style: writing preferences load
- [ ] API Keys: key list + generate button
- [ ] Integrations: Hashnode, Dev.to, WordPress, Twitter, LinkedIn cards
- [ ] Webhooks: webhook list or empty state + create button
- [ ] Tab switching updates URL (?tab=)
- [ ] Settings save and persist across page reloads

### Gate 5: Automation Page

- [ ] Simplified layout: trigger card(s) with Edit/Run Now/Disable
- [ ] Empty state shows "Create First Trigger" CTA
- [ ] Trigger creation via dialog (not inline form)

### Gate 6: Dashboard

- [ ] StatCards clickable (Sessions → /sessions, Insights → /insights, Content → /content)
- [ ] Activity log / event log visible with entries
- [ ] Quick action buttons functional

### Gate 7: URL Redirects

- [ ] `/series` → `/content?filter=series` (or similar)
- [ ] `/collections` → `/content?filter=collections` (or similar)
- [ ] `/recommendations` → `/insights`
- [ ] `/observability` → `/` (dashboard)
- [ ] `/settings/style` → `/settings?tab=style`
- [ ] `/settings/api-keys` → `/settings?tab=api-keys`
- [ ] `/settings/integrations` → `/settings?tab=integrations`
- [ ] `/settings/webhooks` → `/settings?tab=webhooks`

### Gate 8: Mobile Navigation

- [ ] Resize to 375px width
- [ ] Bottom nav shows 5 items: Home, Sessions, Content, Automation, More
- [ ] "More" sheet opens with Insights, Analytics, Settings
- [ ] Each link in "More" sheet navigates correctly

### Gate 9: Build & Console

- [ ] `bun run build` passes with zero errors
- [ ] No console errors on Dashboard
- [ ] No console errors on Sessions page
- [ ] No console errors on Insights page
- [ ] No console errors on Content page
- [ ] No console errors on Settings page
- [ ] No console errors on Automation page

## Evidence Collection

Save all screenshots to: `e2e-evidence/codebase-overhaul-v2/`

For each gate:
1. Navigate to page via Playwright MCP
2. Capture screenshot with descriptive filename
3. Write what is visible in the screenshot
4. Mark PASS or FAIL with reasoning
5. If FAIL: document what's wrong, fix it, re-validate

## Success Criteria

- [ ] All 9 gates PASS
- [ ] Zero functionality lost compared to pre-overhaul state
- [ ] All deleted page functionality restored via consolidation
- [ ] All old URLs redirect correctly
- [ ] Production build clean
- [ ] Mobile navigation complete
