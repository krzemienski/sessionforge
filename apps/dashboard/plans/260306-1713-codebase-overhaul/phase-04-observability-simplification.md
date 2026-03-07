# Phase 04 — Observability Simplification

**Priority:** HIGH
**Status:** ✓ COMPLETED
**Effort:** Medium (3-4 hours)
**Completed:** 2026-03-06

---

## Skills to Invoke

| Skill | When | Purpose |
|-------|------|---------|
| `/code-refactoring` | Before deletion | Audit dependencies before removing observability files |
| `/frontend-design` | During event-log.tsx creation | Simple, clean log viewer component design |
| `/shadcn-ui` | During event-log.tsx creation | Badge (event types), ScrollArea, Card components |
| `/code-review` | After deletion + creation | Verify no broken imports, no dead references |
| `/gate-validation-discipline` | After ALL steps complete | Evidence-based verification of cleanup completeness |

### Gate Validation Checklist (Phase 04)
- [x] **Evidence examined**: `find` output — no files exist in `src/components/observability/`
- [x] **Evidence examined**: `grep` output — no imports of `reactflow`, `dagre`, or `@dagrejs` in codebase
- [x] **Evidence examined**: `package.json` — reactflow and dagre removed from dependencies
- [x] **Evidence examined**: Screenshot — event-log.tsx renders on Dashboard (or standalone /logs page)
- [x] **Evidence examined**: API test — `GET /api/observability/events` returns simplified event list
- [x] **Evidence examined**: Pipeline instrumentation still emits events (run pipeline, check events API)
- [x] **Evidence examined**: `bun run build` output — zero errors

---

## Context

The user explicitly said the current observability page (React Flow graph with agent nodes, Dagre layout, mini-map) is "totally humorous" — way too complex for what's needed. They want:

1. A **simple overview** of system health
2. **Logs flipped in** — see what agents are doing
3. This should be the **first thing you see** on the dashboard

Phase 02 already adds the Activity Log to the Dashboard. This phase simplifies what remains of observability.

## Current Observability Stack (Over-Engineered)

```
src/lib/observability/
├── event-bus.ts           # In-process EventEmitter + ring buffer (1000 events)
├── event-types.ts         # 12 event types (lifecycle, tool, content, pipeline, system)
├── event-writer.ts        # Writes events to DB
├── trace-context.ts       # Distributed tracing (traceId generation)
├── instrument-query.ts    # Wraps Agent SDK query() with observability
├── instrument-pipeline.ts # Wraps pipeline stages
├── sse-broadcaster.ts     # SSE streaming to UI

src/components/observability/
├── agent-graph.tsx        # React Flow canvas
├── agent-node.tsx         # Agent node component
├── pipeline-node.tsx      # Pipeline stage node
├── query-node.tsx         # Query node
├── tool-node.tsx          # Tool node

src/app/api/observability/
├── events/route.ts        # GET events
├── stream/route.ts        # SSE stream
├── active/route.ts        # Active operations
├── traces/[traceId]/route.ts # Trace details
├── test/route.ts          # Test endpoint
├── validate/route.ts      # Validation endpoint

src/hooks/
├── use-observability-stream.ts  # SSE hook
```

**That's 16 files for observability.** The React Flow graph, Dagre layout, node types, and real-time streaming are all infrastructure for a feature that should just be a log viewer.

## Target State

### Keep (Backend — Still Useful)
- `event-bus.ts` — Keep the event emitter, it's lightweight
- `event-types.ts` — Keep type definitions
- `instrument-pipeline.ts` — Keep pipeline instrumentation (feeds activity log)
- `instrument-query.ts` — Keep query instrumentation (feeds activity log)

### Simplify (API)
- `events/route.ts` — Keep, simplify response format
- `stream/route.ts` — Keep for real-time updates on Dashboard

### Remove (Over-Engineered UI)
- `agent-graph.tsx` — Delete React Flow graph
- `agent-node.tsx`, `pipeline-node.tsx`, `query-node.tsx`, `tool-node.tsx` — Delete all node components
- `use-observability-stream.ts` — Refactor into simpler `use-activity-stream.ts`
- `traces/[traceId]/route.ts` — Delete (no trace detail view needed)
- `active/route.ts` — Delete (replaced by activity log)
- `test/route.ts`, `validate/route.ts` — Delete (dev-only endpoints)
- `event-writer.ts` — Keep if events are persisted to DB, otherwise delete
- `trace-context.ts` — Simplify (just generate traceIds, drop distributed tracing ceremony)
- `sse-broadcaster.ts` — Keep, reuse for activity stream

### New: Simple Event Log Page

Instead of a full Observability page, add a **"Logs" page** accessible from Dashboard's "View All" link:

```
┌─────────────────────────────────────────────┐
│  System Logs                      [Filter ▼]│
├─────────────────────────────────────────────┤
│  🟢 17:20:34  agent:complete                │
│     corpus-analyzer finished (10 insights)  │
│                                             │
│  🔵 17:20:30  tool:call                     │
│     create_insight — "Pattern: CLI..."      │
│                                             │
│  🟢 17:20:03  agent:start                   │
│     corpus-analyzer — analyzing 1513 sess.  │
│                                             │
│  🟢 17:19:58  pipeline:stage                │
│     extracting → generating                 │
│                                             │
│  (... scrollable, time-descending ...)      │
└─────────────────────────────────────────────┘
```

This is a flat list — no graph, no nodes, no Dagre layout. Just colored log entries with timestamps.

## Implementation

### Step 1: Delete React Flow Components

Remove entire `src/components/observability/` directory (5 files).

### Step 2: Delete Unnecessary API Routes

Remove:
- `src/app/api/observability/test/route.ts`
- `src/app/api/observability/validate/route.ts`
- `src/app/api/observability/active/route.ts`
- `src/app/api/observability/traces/[traceId]/route.ts`

### Step 3: Simplify Event Types

Reduce from 12 event types to 5:
- `agent:start`, `agent:complete`, `agent:error`
- `pipeline:stage` (scanning/extracting/generating/complete/failed)
- `system:info` (catch-all for other events)

### Step 4: Create Simple Log Viewer

New component: `src/components/dashboard/event-log.tsx`
- Flat list of events
- Color-coded icons (green=success, red=error, blue=info)
- Timestamp + event type + description
- Filter by type (dropdown)
- Used on Dashboard (compact, last 10) and standalone Logs page (full, paginated)

### Step 5: Remove Observability Page

The page at `[workspace]/observability/` gets removed (Phase 03 already removes it from nav). The Logs page becomes accessible from Dashboard "View All" link.

### Step 6: Clean Up Dependencies

Remove `reactflow`, `dagre`, `@dagrejs/dagre` from `package.json` if no longer used elsewhere.

---

## Files to Delete

- `src/components/observability/agent-graph.tsx`
- `src/components/observability/agent-node.tsx`
- `src/components/observability/pipeline-node.tsx`
- `src/components/observability/query-node.tsx`
- `src/components/observability/tool-node.tsx`
- `src/app/api/observability/test/route.ts`
- `src/app/api/observability/validate/route.ts`
- `src/app/api/observability/active/route.ts`
- `src/app/api/observability/traces/[traceId]/route.ts`
- `src/app/(dashboard)/[workspace]/observability/page.tsx`
- `src/hooks/use-observability-stream.ts`

## Files to Create

- `src/components/dashboard/event-log.tsx` — Simple log viewer
- `src/app/(dashboard)/[workspace]/logs/page.tsx` — Full log page (optional, linked from Dashboard)

## Files to Modify

- `src/lib/observability/event-types.ts` — Simplify event types
- `src/lib/observability/trace-context.ts` — Simplify tracing
- `package.json` — Remove reactflow/dagre if unused

## Success Criteria

- [x] React Flow graph removed
- [x] Dashboard shows simple activity log (from Phase 02)
- [x] Optional Logs page shows full event history
- [x] Pipeline instrumentation still works (events still emitted)
- [x] No reactflow/dagre dependencies if unused
- [x] Production build passes
