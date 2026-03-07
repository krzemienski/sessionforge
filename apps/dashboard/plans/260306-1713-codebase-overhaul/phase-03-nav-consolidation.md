# Phase 03 — Navigation Consolidation

**Priority:** HIGH
**Status:** ✓ COMPLETED
**Effort:** Medium (4-6 hours)
**Completed:** 2026-03-06

---

## Skills to Invoke

| Skill | When | Purpose |
|-------|------|---------|
| `/ui-ux-pro-max` | Before consolidation | Navigation IA decisions, mobile nav patterns |
| `/frontend-design` | During tab/filter implementation | Tab navigation patterns, filter UX for Content page |
| `/react-best-practices` | During implementation | URL state management, router patterns for redirects |
| `/shadcn-ui` | During implementation | Tabs, Sheet (mobile), Dialog (CRUD modals) components |
| `/design-exploration` | Before merging Series/Collections | Evaluate filter vs tab vs view toggle for Content page |
| `/code-review` | After each merge step | Verify no functionality lost during consolidation |
| `/gate-validation-discipline` | After ALL steps complete | Evidence-based verification of nav structure and redirects |

### Gate Validation Checklist (Phase 03)
- [x] **Evidence examined**: Screenshot — sidebar shows exactly 7 items (Dashboard, Sessions, Insights, Content, Analytics, Automation, Settings)
- [x] **Evidence examined**: Click test — all 7 nav items navigate to correct pages
- [x] **Evidence examined**: Screenshot — Content page shows Series filter/view
- [x] **Evidence examined**: Screenshot — Content page shows Collections filter/view
- [x] **Evidence examined**: Screenshot — Insights page shows Recommendations/Suggested Topics section
- [x] **Evidence examined**: Screenshot — Settings page with tab navigation (General, Style, API Keys, Integrations, Webhooks)
- [x] **Evidence examined**: Redirect test — `/series` → `/content?view=series`, `/collections` → `/content?view=collections`, `/recommendations` → `/insights`
- [x] **Evidence examined**: `bun run build` output — zero errors

---

## Context

Current sidebar has 11 nav items + 7 settings pages = 18 routes. Many are thin pages that could be consolidated. The user finds the navigation bloated.

## Current Nav (11 items)

```
Dashboard · Sessions · Insights · Content · Series · Analytics · Collections · Recommendations · Automation · Observability
Settings (7 sub-pages)
```

## Target Nav (7 items)

```
Dashboard · Sessions · Insights · Content · Analytics · Automation
Settings (single page with tabs)
```

### What Gets Merged

| Removed Page | Merged Into | How |
|-------------|-------------|-----|
| **Series** | Content | Add "Series" tab/filter on Content page. Series CRUD via modal. |
| **Collections** | Content | Add "Collections" tab/filter on Content page. Collection CRUD via modal. |
| **Recommendations** | Insights | Add "Suggested Topics" section at top of Insights page. |
| **Observability** | Dashboard | Activity log replaces full observability (Phase 02). Keep event log accessible via "View All" link. |
| **Settings sub-pages** | Settings (tabs) | Single page with tab navigation: General · Style · API Keys · Integrations · Webhooks |
| **WordPress settings** | Integrations tab | WordPress config moves into Integrations tab. |

## Implementation

### Step 1: Update Sidebar Navigation

File: `src/components/layout/app-sidebar.tsx`

Remove nav items: Series, Collections, Recommendations, Observability
Keep: Dashboard, Sessions, Insights, Content, Analytics, Automation, Settings

### Step 2: Merge Series into Content Page

- Add a "Series" view toggle alongside Calendar/Pipeline/List
- Or add a filter dropdown "Filter by Series" on the Content page
- Series CRUD (create, edit, delete) via dialog/modal triggered from Content page
- Keep `/api/series/*` routes unchanged (backend stays)
- Remove `[workspace]/series/page.tsx` route

### Step 3: Merge Collections into Content Page

- Same approach as Series — add "Collections" filter/view
- Collection CRUD via modal
- Remove `[workspace]/collections/page.tsx` route

### Step 4: Merge Recommendations into Insights

- Add "Suggested Topics" card or section at top of Insights page
- Pull data from existing `/api/content/recommendations` endpoint
- Remove `[workspace]/recommendations/page.tsx` route

### Step 5: Consolidate Settings into Tabs

- Single `[workspace]/settings/page.tsx` with tab navigation
- Tabs: General | Style | API Keys | Integrations | Webhooks
- WordPress config folds into Integrations tab
- Remove individual settings sub-routes (keep API routes)

### Step 6: Add Redirects

For any bookmarked URLs:
- `/[workspace]/series` → `/[workspace]/content?view=series`
- `/[workspace]/collections` → `/[workspace]/content?view=collections`
- `/[workspace]/recommendations` → `/[workspace]/insights`
- `/[workspace]/observability` → `/[workspace]` (dashboard)

---

## Files to Modify

- `src/components/layout/app-sidebar.tsx` — Remove nav items
- `src/app/(dashboard)/[workspace]/content/page.tsx` — Add Series/Collections views
- `src/app/(dashboard)/[workspace]/insights/page.tsx` — Add Recommendations section
- `src/app/(dashboard)/[workspace]/settings/page.tsx` — Add tab navigation

## Files to Remove (or redirect)

- `src/app/(dashboard)/[workspace]/series/page.tsx`
- `src/app/(dashboard)/[workspace]/collections/page.tsx`
- `src/app/(dashboard)/[workspace]/recommendations/page.tsx`
- `src/app/(dashboard)/[workspace]/observability/page.tsx`
- `src/app/(dashboard)/[workspace]/settings/style/page.tsx`
- `src/app/(dashboard)/[workspace]/settings/api-keys/page.tsx`
- `src/app/(dashboard)/[workspace]/settings/integrations/page.tsx`
- `src/app/(dashboard)/[workspace]/settings/skills/page.tsx`
- `src/app/(dashboard)/[workspace]/settings/webhooks/page.tsx`
- `src/app/(dashboard)/[workspace]/settings/wordpress/page.tsx`

## Success Criteria

- [x] Sidebar shows 7 items (down from 11)
- [x] Series/Collections accessible from Content page
- [x] Recommendations visible on Insights page
- [x] Settings page uses tab navigation (no sub-routes)
- [x] Old URLs redirect properly
- [x] No functionality lost
- [x] Production build passes
