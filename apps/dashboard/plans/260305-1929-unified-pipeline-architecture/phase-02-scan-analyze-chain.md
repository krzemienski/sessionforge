# Phase 2: Auto-Chain Scan → Analyze

## Overview
- Priority: HIGH
- Status: TODO
- Depends on: Phase 1

## Problem

Currently, `GET /api/sessions/scan/stream` does:
1. scanSessionFiles → parse → normalize → index → STOP

After this phase, it does:
1. scanSessionFiles → parse → normalize → index
2. → corpus analysis (automatic, opt-out with `analyzeAfterScan=false`)
3. SSE events for both phases streamed to client

## Changes

### `src/app/api/sessions/scan/stream/route.ts`

After the indexing section (line ~106), add:

```typescript
// After indexing completes...
const analyze = searchParams.get("analyzeAfterScan") !== "false";

if (analyze && result.new > 0) {
  obs.stage("analyzing");
  enqueue({ type: "analyzing", message: "Analyzing session patterns..." });

  try {
    const analysisResult = await analyzeCorpus({
      workspaceId: ws.id,
      lookbackDays,
      traceId: obs.traceId,
    });

    enqueue({
      type: "analysis_complete",
      briefId: analysisResult.briefId,
      insightCount: analysisResult.insightCount,
    });
  } catch (analysisErr) {
    // Analysis failure is non-fatal — scan still succeeded
    enqueue({
      type: "analysis_error",
      message: analysisErr instanceof Error ? analysisErr.message : String(analysisErr),
    });
  }
}
```

**Key decisions:**
- Analysis only runs when `result.new > 0` (new sessions found)
- Analysis failure doesn't fail the scan
- New SSE event types: `analyzing`, `analysis_complete`, `analysis_error`
- `analyzeAfterScan=false` query param to skip (for quick re-index)

### `src/lib/automation/pipeline.ts`

Replace the per-session extraction loop (lines 108-118):

```typescript
// BEFORE (per-session, broken):
for (const session of sessionsWithoutInsights) {
  await extractInsight({ workspaceId, sessionId: session.sessionId });
}

// AFTER (corpus analysis):
const analysisResult = await analyzeCorpus({
  workspaceId: workspace.id,
  lookbackDays,
  traceId: obs.traceId,
});
```

## Implementation Steps

1. [ ] Add `analyzeCorpus` import to scan stream route
2. [ ] Add analysis phase after indexing with SSE events
3. [ ] Add `analyzeAfterScan` query param support
4. [ ] Replace per-session loop in automation pipeline with corpus analysis
5. [ ] Update SSE event types in client hooks if needed
6. [ ] Verify scan still works when analysis is skipped

## Success Criteria

- "Scan Now" triggers analysis automatically after indexing
- Analysis progress visible in SSE stream
- Analysis failure doesn't break the scan
- Automation pipeline uses corpus analysis instead of per-session extraction
