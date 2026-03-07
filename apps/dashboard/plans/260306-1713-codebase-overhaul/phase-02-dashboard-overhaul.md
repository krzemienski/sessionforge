# Phase 02 — Dashboard Overhaul: Activity Log First

**Priority:** HIGH
**Status:** ✓ COMPLETED
**Effort:** Medium (4-6 hours)
**Completed:** 2026-03-06

---

## Skills to Invoke

| Skill | When | Purpose |
|-------|------|---------|
| `/ui-ux-pro-max` | Before designing layout | Expert UI/UX guidance for dashboard layout, information hierarchy |
| `/frontend-design` | During component creation | Component architecture, responsive patterns |
| `/shadcn-ui` | During component creation | Use shadcn/ui primitives (Card, Badge, Button) consistently |
| `/react-best-practices` | During implementation | React patterns, state management, performance |
| `/design-exploration` | Before implementation | Explore layout alternatives for activity log placement |
| `/code-review` | After implementation | Review component quality, accessibility, performance |
| `/gate-validation-discipline` | After ALL steps complete | Evidence-based verification with screenshots and UI interaction |

### Gate Validation Checklist (Phase 02)
- [x] **Evidence examined**: Screenshot — dashboard shows activity log as primary content
- [x] **Evidence examined**: Screenshot — stats cards visible with correct counts
- [x] **Evidence examined**: Click test — stats cards navigate to Sessions/Insights/Content pages
- [x] **Evidence examined**: Screenshot — empty state renders when no activity exists
- [x] **Evidence examined**: API response — `GET /api/activity` returns well-formed `ActivityEvent[]`
- [x] **Evidence examined**: `bun run build` output — zero errors

---

## Context

The user wants the dashboard to be the first useful thing you see — not just stats cards. The observability system (React Flow graph) is over-engineered for the current need. What's actually needed: a simple activity log showing what the system has been doing (agent runs, pipeline executions, scan results).

## Current State

Dashboard Home (`[workspace]/page.tsx`) shows:
- Session count, insights count, drafts count, last scan time
- "Scan Now" button

This is a dead page — users scan sessions from the Sessions page, not here.

## Target State

Dashboard becomes the **command center**:

```
┌─────────────────────────────────────────────┐
│  Dashboard                          [Scan ▶] │
├─────────────┬─────────────┬─────────────────┤
│ 1,513       │ 47          │ 4               │
│ Sessions    │ Insights    │ Drafts          │
├─────────────┴─────────────┴─────────────────┤
│                                             │
│  Activity Log                    [View All] │
│  ─────────────────────────────────────────  │
│  ● Pipeline complete — blog_post generated  │
│    "From Manual Audits to Real-Time..."     │
│    2h ago · 1,513 sessions · 1,574 words    │
│                                             │
│  ● Session scan completed                   │
│    12 new sessions indexed                  │
│    2h ago                                   │
│                                             │
│  ● Agent: corpus-analyzer finished          │
│    Extracted 10 insights (avg score: 42)    │
│    2h ago                                   │
│                                             │
│  ● Agent: blog-writer started               │
│    Generating blog_post from 10 insights    │
│    2h ago                                   │
│                                             │
│  (empty state: "No recent activity.         │
│   Run a scan to get started.")              │
│                                             │
├─────────────────────────────────────────────┤
│  Quick Actions                              │
│  [Scan Sessions] [Generate Content] [View   │
│   Content Calendar]                         │
└─────────────────────────────────────────────┘
```

## Implementation

### Step 1: Create Activity Log Data Source

Pull from existing data:
- `automationRuns` table — pipeline executions with status, timestamps, results
- `agentRuns` table — individual agent executions
- `claudeSessions` (scan metadata) — latest scan timestamp and counts

No new tables needed. Query the 3 tables, merge by timestamp, return as unified activity feed.

### Step 2: Create Activity Log API

**New route:** `GET /api/activity` (or extend existing dashboard stats route)

Returns:
```ts
type ActivityEvent = {
  id: string
  type: 'pipeline_complete' | 'pipeline_failed' | 'scan_complete' | 'agent_start' | 'agent_complete' | 'agent_error'
  title: string
  description: string
  timestamp: Date
  metadata: Record<string, unknown> // sessionsScanned, postId, insightCount, etc.
}
```

### Step 3: Update Dashboard Page

Replace current static stats with:
1. **Stats row** (keep, but make them link to respective pages)
2. **Activity Log** — scrollable list of recent events, newest first
3. **Quick Actions** — buttons that navigate to key workflows
4. Remove the "Scan Now" button from here (it lives on Sessions page)

### Step 4: Create `<ActivityLog>` Component

Simple list component:
- Each event has icon (color-coded by type), title, description, relative timestamp
- Green dot = success, Red dot = error, Blue dot = in-progress
- Click event → navigates to relevant page (pipeline run → Automation, post → Content Editor)
- Empty state with call-to-action

---

## Files to Create

- `src/components/dashboard/activity-log.tsx` — Activity log component
- `src/app/api/activity/route.ts` — Activity feed API

## Files to Modify

- `src/app/(dashboard)/[workspace]/page.tsx` — Rebuild dashboard layout

## Success Criteria

- [x] Dashboard shows activity log as primary content
- [x] Activity events sourced from automationRuns + agentRuns
- [x] Stats cards link to their respective pages
- [x] Quick action buttons navigate to key workflows
- [x] Empty state shows helpful call-to-action
- [x] Mobile responsive
- [x] Production build passes
