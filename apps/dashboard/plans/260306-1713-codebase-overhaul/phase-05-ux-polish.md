# Phase 05 — UX Polish & Improvements

**Priority:** MEDIUM
**Status:** ✓ COMPLETED
**Effort:** Medium (4-6 hours)
**Completed:** 2026-03-06

---

## Skills to Invoke

| Skill | When | Purpose |
|-------|------|---------|
| `/ui-ux-pro-max` | Before all improvements | Expert UX guidance for flow visibility, empty states, mobile nav |
| `/frontend-design` | During banner/empty state creation | Component patterns, responsive design |
| `/shadcn-ui` | During implementation | Alert (banners), Button, Sheet (mobile nav) components |
| `/ui-styling` | During implementation | Consistent spacing, typography, color usage |
| `/ui-review-tahoe` | After implementation | UX review against best practices |
| `/design-exploration` | Before automation simplification | Explore layout options for simplified automation page |
| `/react-best-practices` | During implementation | State management for flow banners, navigation patterns |
| `/code-review` | After implementation | Review component quality, accessibility |
| `/gate-validation-discipline` | After ALL improvements | Evidence-based verification with screenshots |

### Gate Validation Checklist (Phase 05)
- [x] **Evidence examined**: Screenshot — Sessions page shows flow banner after scan ("X sessions scanned. [Extract Insights →]")
- [x] **Evidence examined**: Screenshot — Insights page shows flow banner ("X insights available. [Generate Content →]")
- [x] **Evidence examined**: Screenshot — Content page shows pipeline status line
- [x] **Evidence examined**: Click test — stats cards navigate to correct pages
- [x] **Evidence examined**: Screenshot — automation page shows simplified layout (single trigger card + recent runs)
- [x] **Evidence examined**: Screenshot — empty state on Sessions/Insights/Content/Analytics with contextual guidance
- [x] **Evidence examined**: Screenshot — mobile nav shows 5 items (Home, Sessions, Content, Automation, More)
- [x] **Evidence examined**: `bun run build` output — zero errors

---

## Context

With navigation consolidated and observability simplified, this phase focuses on making the remaining pages more intuitive and polished. Key question the user asked: "How do we get from a post? How do the posts actually get generated?"

The UX should make the content generation flow **obvious and discoverable**.

## Improvements

### 1. Sessions → Insights → Content Flow Visibility

**Problem:** Users don't understand how sessions become content. The pipeline is invisible.

**Fix: Add flow indicators**

On the **Sessions page**, after a scan completes:
- Show a banner: "12 sessions scanned. [Extract Insights →]"
- The button navigates to Insights page with a "new" filter

On the **Insights page**, when insights exist:
- Show a banner: "47 insights available. [Generate Content →]"
- The button navigates to the Content creation flow

On the **Content page**, show pipeline status:
- "Last pipeline: 2h ago — 1,513 sessions → 10 insights → 1 blog post"
- This makes the flow visible without needing a separate observability page

### 2. Automation Page Simplification

**Problem:** Automation page has trigger creation, cron config, execution history — a lot for what's essentially "run the pipeline on a schedule."

**Fix: Simplify to essentials**

```
┌─────────────────────────────────────────────┐
│  Automation                                 │
├─────────────────────────────────────────────┤
│  Pipeline Schedule                          │
│  ┌─────────────────────────────────────┐   │
│  │ ● Enabled   Every week on Monday    │   │
│  │   Content: blog_post                │   │
│  │   Lookback: 7 days                  │   │
│  │   [Edit] [Run Now] [Disable]        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Recent Runs                     [View All] │
│  ─────────────────────────────────────────  │
│  ✓ Mar 5 — blog_post — 1,513 sessions      │
│    "From Manual Audits to Real-Time..."     │
│  ✗ Mar 3 — failed — timeout                │
│  ✓ Feb 28 — twitter_thread — 800 sessions  │
└─────────────────────────────────────────────┘
```

Keep it simple: one trigger config card + recent runs list. Remove the complex trigger creation form unless multiple triggers are truly needed.

### 3. Content Calendar Improvements

**Problem:** Calendar view is functional but could be more useful.

**Fix:**
- Show content type icons on calendar cells (blog=📝, twitter=🐦, linkedin=💼)
- Click a date → opens "New Content" dialog pre-filled with that date
- Drag posts between dates for rescheduling
- Show "suggested slots" based on posting frequency

### 4. Stats Cards as Navigation

**Problem:** Dashboard stats cards (Sessions: 1,513 / Insights: 47 / Drafts: 4) are display-only.

**Fix:** Make them clickable links:
- Click "1,513 Sessions" → navigates to Sessions page
- Click "47 Insights" → navigates to Insights page
- Click "4 Drafts" → navigates to Content page filtered by status=draft

### 5. Empty States

**Problem:** Pages with no data show generic empty states.

**Fix:** Contextual empty states that guide the user:
- Sessions (empty): "Import your Claude Code sessions to get started. [Scan Now]"
- Insights (empty): "No insights yet. Scan sessions first, then extract insights. [Go to Sessions →]"
- Content (empty): "No content created. Generate from insights or write manually. [Generate from Insights →] [Write New]"
- Analytics (empty): "Connect Twitter or LinkedIn to track engagement. [Set Up Integrations →]"

### 6. Mobile Bottom Nav

**Problem:** 7 nav items won't fit cleanly on mobile bottom nav.

**Fix:** Mobile bottom nav shows 5 items:
```
Home | Sessions | Content | Automation | More (...)
```
"More" opens a sheet with: Insights, Analytics, Settings

---

## Files to Modify

- `src/app/(dashboard)/[workspace]/page.tsx` — Clickable stats
- `src/app/(dashboard)/[workspace]/sessions/page.tsx` — Flow banner
- `src/app/(dashboard)/[workspace]/insights/page.tsx` — Flow banner
- `src/app/(dashboard)/[workspace]/content/page.tsx` — Pipeline status line
- `src/app/(dashboard)/[workspace]/automation/page.tsx` — Simplify layout
- `src/components/layout/mobile-bottom-nav.tsx` — Update for 5 items
- Various pages — Contextual empty states

## Success Criteria

- [x] Flow banners guide users through Sessions → Insights → Content
- [x] Stats cards are clickable navigation
- [x] Automation page simplified to essentials
- [x] Empty states provide actionable guidance
- [x] Mobile nav works with consolidated items
- [x] Production build passes
