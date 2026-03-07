# Phase 3: Add Corpus-Analyzer to Observability Graph

## Overview
- **Priority:** MEDIUM
- **Status:** TODO
- **Depends on:** Nothing (independent of Phases 1-2)
- **Estimated LOC:** ~30 in 1 file

## Problem

`graph-state.ts` classifies agent types into two sets for visual differentiation:
- `QUERY_AGENTS`: seo-generator, diagram-generator, arc-suggester, evidence-classifier, style-learner → rendered as "query" nodes
- `PIPELINE_AGENTS`: session-scan, automation-pipeline → rendered as "pipeline" nodes
- Everything else → falls through to generic "agent" type

The corpus-analyzer is **in neither set**. When it fires events, it renders as a generic "agent" node — no visual distinction from content writers. The observability graph should show the pipeline flow:

```
[session-scan] → [corpus-analyzer] → [blog-writer]
     pipeline         analysis           agent
```

Currently it shows:
```
[session-scan] → [corpus-analyzer] → [blog-writer]
     pipeline         agent (generic)      agent
```

## Target

Add an `ANALYSIS_AGENTS` classification so corpus-analyzer (and future analysis agents) get a distinctive "analysis" node type in the graph, visually distinguishable from generic agents and pipeline stages.

## Related Code Files

### File to Modify
| File | Lines | Change |
|------|-------|--------|
| `src/components/observability/graph-state.ts` | 9, 47-59 | Add "analysis" to GraphNode type union, add ANALYSIS_AGENTS set, update getNodeType() |

### Files to Read (context)
| File | Why |
|------|-----|
| `src/lib/observability/event-types.ts` | Confirm event types corpus-analyzer emits |
| `src/lib/ai/orchestration/tool-registry.ts` | Confirm corpus-analyzer is registered |

## Implementation Steps

### Step 1: Extend GraphNode type union

**File:** `src/components/observability/graph-state.ts:9`

```typescript
// Before:
type: "pipeline" | "agent" | "tool" | "query";

// After:
type: "pipeline" | "agent" | "tool" | "query" | "analysis";
```

### Step 2: Add ANALYSIS_AGENTS set

**File:** `src/components/observability/graph-state.ts` (after line 54, before `getNodeType`)

```typescript
const ANALYSIS_AGENTS = new Set([
  "corpus-analyzer",
]);
```

### Step 3: Update getNodeType()

**File:** `src/components/observability/graph-state.ts:56-60`

```typescript
// Before:
function getNodeType(agentType: string): GraphNode["type"] {
  if (PIPELINE_AGENTS.has(agentType)) return "pipeline";
  if (QUERY_AGENTS.has(agentType)) return "query";
  return "agent";
}

// After:
function getNodeType(agentType: string): GraphNode["type"] {
  if (PIPELINE_AGENTS.has(agentType)) return "pipeline";
  if (ANALYSIS_AGENTS.has(agentType)) return "analysis";
  if (QUERY_AGENTS.has(agentType)) return "query";
  return "agent";
}
```

**Order matters:** Check ANALYSIS_AGENTS before QUERY_AGENTS because corpus-analyzer is more specific than a generic query agent.

## UI Styling (out of scope but noted)

The observability graph React component that consumes `GraphNode.type` will need a style entry for the new `"analysis"` type. This is a pure UI concern — likely a color/icon in the React Flow custom node component. If no custom styling is added, it will fall through to whatever the default node rendering is (acceptable for now).

The graph component files that would need styling updates:
- `src/components/observability/` — whichever component renders nodes by type

This is cosmetic and can be done later. The critical change is the classification.

## Success Criteria

- [ ] `GraphNode["type"]` union includes `"analysis"`
- [ ] `ANALYSIS_AGENTS` set contains `"corpus-analyzer"`
- [ ] `getNodeType("corpus-analyzer")` returns `"analysis"`
- [ ] Existing agents still classify correctly (pipeline, query, generic agent)
- [ ] Production build compiles with zero TS errors

## What This Does NOT Do

- Does not add new event types — corpus-analyzer already emits `agent:start`, `agent:complete`, `agent:error`
- Does not modify the event bus or SSE broadcasting
- Does not add custom node styling (can be done separately)
- Does not create edges between corpus-analyzer and content writers (edges are created automatically in the reducer when agents share a traceId)
