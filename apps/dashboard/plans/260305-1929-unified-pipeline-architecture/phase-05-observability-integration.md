# Phase 5: Observability — All Phases Visible in Agent Graph

## Overview
- Priority: MEDIUM
- Status: TODO
- Depends on: Phase 1, Phase 2, Phase 4 (observability page already built)

## Problem

The observability page and agent graph (built in prior work) show agent events. The new corpus-analyzer and enriched content pipeline need to emit events that the graph can visualize.

## Changes

### `src/components/observability/graph-state.ts`

Add corpus-analyzer to known node types:

```typescript
const PIPELINE_AGENTS = new Set([
  "session-scan", "automation-pipeline",
]);

// corpus-analyzer is a new agent type — shows as "agent" node (not pipeline)
// But it should have a distinctive visual since it's the core analysis step
const ANALYSIS_AGENTS = new Set([
  "corpus-analyzer",
]);
```

Add handling for new event types from corpus analysis:
- `pattern:found` → update node with pattern count badge
- `brief:complete` → mark corpus-analyzer as complete

### Graph visualization of unified pipeline

When scan triggers analysis, the graph shows:

```
[session-scan] ──spawns──> [corpus-analyzer] ──spawns──> [blog-writer]
  (pipeline)                  (analysis)                   (content)
                                  |
                                  ├──spawns──> [social-writer]
                                  └──spawns──> [changelog-writer]
```

Each node shows:
- Status (running/complete/error)
- Duration
- For corpus-analyzer: pattern count badge
- For content writers: content type badge

### Event bus emissions

Already handled by `agent-runner.ts` which emits:
- `agent:start`, `agent:complete`, `agent:error` for every agent
- `tool:call`, `tool:result` for every tool use

The corpus-analyzer agent runs through `runAgent()` which already emits these. No additional instrumentation needed — it works automatically.

## Implementation Steps

1. [ ] Verify corpus-analyzer events appear in graph (should work via agent-runner)
2. [ ] Add analysis-specific node styling if desired (optional)
3. [ ] Test full pipeline visualization: scan → analyze → generate
4. [ ] Verify event log panel shows corpus analysis events

## Success Criteria

- Scanning triggers visible corpus-analyzer node in graph
- Tool calls (list_all_sessions, get_session_messages, create_insight_brief) visible
- Content generation agents appear as children of the pipeline
- Full trace from scan → analyze → generate visible in single graph
