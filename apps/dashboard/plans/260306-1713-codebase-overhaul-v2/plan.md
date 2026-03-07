# Codebase Overhaul v2 — Consolidation & UX Polish

**Created:** 2026-03-06
**Status:** NOT STARTED
**Total Phases:** 5

---

## Background

The original overhaul plan (v1) ran across 5+ context windows and marked itself 100% complete when critical work was never done. Navigation items were removed from the sidebar but the underlying functionality was never relocated — resulting in a net regression where features that previously worked became unreachable.

This plan addresses only the unfinished consolidation work with validation baked into every phase.

## What Was Actually Completed (v1)

- Sidebar reduced from 11 to 7 nav items
- Mobile bottom nav set to 5 tabs
- Dashboard: clickable StatCards, ActivityLog, Quick Actions
- Sessions page: SSE streaming scan, flow banner linking to Insights
- Insights page: flow banner linking to Content generation
- React Flow graph + dagre removed (observability UI deleted)
- Parser deduplicated (single `parseSessionLines()`)
- reactflow/dagre dependencies removed
- Production build passes

## What Was NOT Done (Functionality Lost)

| Feature | Old Location | Current State |
|---------|-------------|---------------|
| Series management | `/series` page | Page DELETED, API routes orphaned |
| Collections management | `/collections` page | Page DELETED, API routes orphaned |
| Recommendations/Topics | `/recommendations` page | Page DELETED, API route orphaned |
| Style settings | `/settings/style` | Page DELETED, no replacement |
| API Keys settings | `/settings/api-keys` | Page DELETED, no replacement |
| Integrations settings | `/settings/integrations` | Page DELETED, no replacement |
| Webhooks settings | `/settings/webhooks` | Page DELETED, no replacement |
| URL redirects | N/A | Not implemented (old URLs → 404) |
| Event log component | N/A | Never created |
| Automation simplification | `/automation` | Still has full complex form |
| Pipeline status on Content | `/content` | Not added |
| Mobile "More" sheet | Mobile nav | Not implemented |

## Phase Overview

| Phase | Name | Priority | Status |
|-------|------|----------|--------|
| 01 | Content Page: Series & Collections | HIGH | NOT STARTED |
| 02 | Insights Page: Recommendations | HIGH | NOT STARTED |
| 03 | Settings Page: Tab Navigation | HIGH | NOT STARTED |
| 04 | UX Polish (Automation, Event Log, Mobile, Redirects) | MEDIUM | NOT STARTED |
| 05 | Final Validation | HIGH | NOT STARTED |

## Key Principle

Every phase ends with a validation gate. The gate requires:
1. Playwright navigation to the affected page
2. Screenshot captured
3. Evidence description citing what is visible
4. Build verification (`bun run build` passes)
5. PASS/FAIL verdict before proceeding to next phase
