# Phase 4: UI — Scan Progress & Dashboard Pipeline View

## Overview
- Priority: MEDIUM
- Status: TODO
- Depends on: Phase 2

## Problem

"Scan Now" button currently shows: scanning files → progress → complete.
After Phase 2, it also runs analysis. The UI needs to reflect the full pipeline.

## Changes

### Dashboard "Scan Now" flow

Update the scan progress UI to show all phases:

```
[Scanning]  ████████░░  47/52 sessions
[Indexing]   Waiting...
[Analyzing]  Waiting...

→ becomes →

[Scanning]  ████████████  52/52 sessions  ✓
[Indexing]   12 new, 40 updated  ✓
[Analyzing]  Found 4 cross-session patterns  ✓
```

### New SSE event handling in `use-sessions.ts` or scan hook

Handle new event types:
- `analyzing` → show "Analyzing patterns..." phase
- `analysis_complete` → show pattern count, link to insights
- `analysis_error` → show warning (non-fatal)

### Dashboard after scan

After scan completes, dashboard shows:
- Session count (existing)
- NEW: Insight patterns found this scan
- NEW: Link to latest insight brief
- NEW: "Generate Content" button (if insights available)

## Implementation Steps

1. [ ] Update scan progress component to show multi-phase pipeline
2. [ ] Handle new SSE event types (analyzing, analysis_complete, analysis_error)
3. [ ] Add post-scan summary with pattern count
4. [ ] Add "Generate Content" CTA after successful analysis

## Success Criteria

- User sees full pipeline progress during scan
- Analysis phase visible with pattern count
- Post-scan dashboard shows actionable next step
