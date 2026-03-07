# Phase 4: Corpus-Aware Progress UI

## Overview
- **Priority:** LOW
- **Status:** TODO
- **Depends on:** Nothing (independent, cosmetic improvement)
- **Estimated LOC:** ~40 across 1-2 files

## Problem

The scan stream route (`src/app/api/sessions/scan/stream/route.ts`) already auto-chains corpus analysis after scan completion (lines 121-146). It sends SSE events like:

```
data: {"type":"scan_complete","sessionCount":5}
data: {"type":"analysis_starting"}
data: {"type":"analysis_complete","insightCount":3}
```

But the frontend scan progress components likely only handle `scan_progress` and `scan_complete` events. The `analysis_starting` and `analysis_complete` events may not be reflected in the UI, leaving users wondering why the pipeline seems to "hang" between scan completion and content generation.

## Target

The scan progress UI should show a clear two-phase flow:
1. **Scanning**: "Scanning sessions... (3/5)" with progress bar
2. **Analyzing**: "Analyzing patterns across sessions..." with indeterminate progress
3. **Complete**: "Found 3 cross-session insights" with insight count

## Research Needed

Before implementing, read these files to understand the current progress UI:

| File | Why |
|------|-----|
| `src/hooks/use-sessions.ts` | How the frontend consumes SSE scan events |
| `src/app/(dashboard)/[workspace]/sessions/page.tsx` | Where scan progress is displayed |
| `src/app/api/sessions/scan/stream/route.ts:121-146` | What SSE events the analysis phase emits |

## Implementation Steps

### Step 1: Identify the scan progress component

Search for components that render scan progress. Look for:
- References to `scan_progress`, `scan_complete` event types
- Progress bar or spinner components in the sessions page
- EventSource or SSE consumption hooks

### Step 2: Add analysis phase handling

In the scan progress component/hook, handle the additional event types:

```typescript
// Existing events:
case "scan_progress":
  // Update progress bar
  break;
case "scan_complete":
  // Show completion
  break;

// NEW events to handle:
case "analysis_starting":
  // Show "Analyzing cross-session patterns..."
  // Switch to indeterminate progress indicator
  break;
case "analysis_complete":
  // Show "Found N cross-session insights"
  // Display insight count from event payload
  break;
```

### Step 3: Update progress display

The progress UI should transition through states:

```
SCANNING → ANALYZING → COMPLETE
  "Scanning sessions... (3/5)"
  → "Analyzing patterns across 5 sessions..."
  → "Complete: 5 sessions scanned, 3 insights found"
```

This likely requires adding a `phase` state variable to the existing scan progress hook:
```typescript
type ScanPhase = "idle" | "scanning" | "analyzing" | "complete" | "error";
```

## Success Criteria

- [ ] UI shows "Analyzing..." phase between scan and completion
- [ ] Insight count is displayed when analysis completes
- [ ] Progress indicator changes from determinate (scanning) to indeterminate (analyzing)
- [ ] Error states in analysis phase are displayed (not silently swallowed)
- [ ] Existing scan-only flows (without analysis) still work

## What This Does NOT Do

- Does not modify the SSE stream route — events are already emitted
- Does not change the pipeline logic — purely a UI concern
- Does not add new API endpoints
