# Phase 04 — UX Polish: Automation, Event Log, Mobile, Redirects

**Priority:** MEDIUM
**Status:** NOT STARTED
**Effort:** Medium (3-4 hours)

---

## Context

Several UX improvements from the original plan were never implemented:
1. Automation page still has full complex trigger creation form — should be simplified
2. No event-log component was created to replace the deleted React Flow graph
3. Mobile nav has no "More" sheet for overflow items (Insights, Analytics)
4. Content page has no pipeline status line
5. Observability redirect not configured

## Implementation

### Step 1: Automation Page Simplification

**File:** `src/app/(dashboard)/[workspace]/automation/page.tsx` (312 lines)

Current state: Full trigger creation form with name, type selector (manual/scheduled/file_watch), content type, cron expression, lookback window. Cards per trigger with grouped run history.

Target: Simplified layout:
- Single "Pipeline Schedule" card showing the active trigger config
- "Edit" / "Run Now" / "Disable" buttons on the card
- "Recent Runs" list below with status, date, content type, session count
- "Create Trigger" only appears as a CTA if no triggers exist (empty state)
- Move the full trigger creation/editing into a dialog/modal instead of inline form

### Step 2: Event Log Component

**File to create:** `src/components/dashboard/event-log.tsx`

Simple log viewer:
- Flat list of events from `GET /api/observability/events`
- Color-coded icons: green (success), red (error), blue (info)
- Each entry: timestamp + event type badge + description
- Optional type filter dropdown
- Compact mode (last 10, used on Dashboard) and full mode (paginated)

**File to modify:** `src/app/(dashboard)/[workspace]/page.tsx`

- Replace or augment the existing ActivityLog with the EventLog component
- "View All" link goes to a logs page or expands the list

### Step 3: Pipeline Status Line on Content Page

**File:** `src/app/(dashboard)/[workspace]/content/page.tsx`

Add a status line at the top of Content page:
- "Last pipeline: 2h ago — 1,513 sessions → 10 insights → 1 blog post"
- Fetch from pipeline run history API
- Shows the most recent successful pipeline run
- If no runs: "No pipeline runs yet. Set up automation to generate content automatically."

### Step 4: Mobile "More" Sheet

**File:** `src/components/layout/mobile-bottom-nav.tsx` (56 lines)

Current: 5 fixed tabs (Home, Sessions, Content, Automation, Settings)
Target: Replace "Settings" tab with "More" tab that opens a Sheet:
- Sheet contains: Insights, Analytics, Settings links
- Tapping any link navigates and closes the sheet

### Step 5: Observability Redirect

**File to create:** `src/app/(dashboard)/[workspace]/observability/page.tsx`

- Redirect `/[workspace]/observability` → `/[workspace]` (dashboard)

## Files to Modify

- `src/app/(dashboard)/[workspace]/automation/page.tsx` — Simplify layout
- `src/app/(dashboard)/[workspace]/page.tsx` — Add/enhance event log
- `src/app/(dashboard)/[workspace]/content/page.tsx` — Add pipeline status line
- `src/components/layout/mobile-bottom-nav.tsx` — Add "More" sheet

## Files to Create

- `src/components/dashboard/event-log.tsx` — Simple event log viewer
- `src/app/(dashboard)/[workspace]/observability/page.tsx` — Redirect to dashboard

## Validation Gate

Before proceeding to Phase 05:

- [ ] Navigate to Automation page via Playwright
- [ ] Simplified layout: trigger card with Edit/Run Now/Disable (screenshot)
- [ ] If no triggers: empty state with "Create First Trigger" CTA (screenshot)
- [ ] Navigate to Dashboard
- [ ] Event log component visible with colored entries (screenshot)
- [ ] Navigate to Content page
- [ ] Pipeline status line visible at top (screenshot, even if "No pipeline runs yet")
- [ ] Resize browser to mobile width (375px)
- [ ] Bottom nav shows "More" tab instead of "Settings" (screenshot)
- [ ] Tap "More" — sheet opens with Insights, Analytics, Settings (screenshot)
- [ ] `/observability` redirects to dashboard (navigate and verify)
- [ ] `bun run build` passes with zero errors
- [ ] No console errors on any modified page

## Success Criteria

- [ ] Automation page simplified to essentials
- [ ] Event log component replaces complex observability UI
- [ ] Pipeline status visible on Content page
- [ ] Mobile nav has "More" sheet for overflow items
- [ ] Observability URL redirects to dashboard
- [ ] Production build passes
