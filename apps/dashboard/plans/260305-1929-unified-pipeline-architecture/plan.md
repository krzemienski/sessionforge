# Unified Pipeline Architecture — Scan → Analyze → Generate

## Problem Statement

The current system has **two disconnected flows** that both duplicate work and leave critical gaps:

**Flow 1: "Scan Now" button** → indexes session files → STOPS. No AI analysis. No insights. No content.

**Flow 2: Automation pipeline** → re-scans the same files → extracts insights ONE session at a time → generates content from isolated insights.

The insight extractor analyzes sessions **individually** — it literally says `"Analyze session X"`. It can never detect:
- Cross-session patterns (recurring errors, evolving approaches)
- Skill development arcs (how a user's techniques improved over time)
- Corrections and pivots (session A broke something, session C fixed it differently)
- Thematic clusters (5 sessions all touched auth, forming a coherent story)

The `/devlog-publisher` skill demonstrates the correct pattern: scan ALL sessions → holistic corpus analysis → ranked insights from cross-session patterns → parallel content generation with different angles.

## Architecture: Current vs Target

### Current State (broken)

```
"Scan Now" button                    Automation Trigger
      |                                     |
      v                                     v
  scan files                            scan files (DUPLICATE)
      |                                     |
      v                                     v
  parse/normalize                       parse/normalize
      |                                     |
      v                                     v
  index to DB                           index to DB
      |                                     |
      v                                     v
    STOP                              for each session:
   (no AI)                              extractInsight(session)  <-- ONE AT A TIME
                                            |
                                            v
                                      generateContent(insightIds)
                                            |
                                            v
                                        create post
```

### Target State (unified)

```
"Scan Now" OR Automation Trigger
            |
            v
    ┌───────────────────┐
    │  Phase 1: SCAN    │  scanSessionFiles → parse → normalize → index
    │  (existing, keep) │  SSE: start → progress → indexed
    └────────┬──────────┘
             │ auto-chain (analyzeAfterScan=true)
             v
    ┌───────────────────────────────┐
    │  Phase 2: CORPUS ANALYSIS     │  NEW agent: corpus-analyzer
    │                               │  Input: ALL sessions in window
    │  Step 1: Bulk session load    │  list_sessions_in_window (bulk tool)
    │  Step 2: Deep-scan promising  │  get_session_messages (selective)
    │  Step 3: Cross-session detect │  Pattern matching across N sessions
    │    - Recurring themes          │  - What topics keep appearing?
    │    - Corrections/pivots        │  - Session A broke it, C fixed it
    │    - Skill evolution           │  - Techniques improved over time
    │    - Tool discoveries          │  - New tool patterns found
    │    - Architecture decisions    │  - Design choices with tradeoffs
    │  Step 4: Score & rank         │  6-dimension weighted scoring
    │  Step 5: Create insight brief │  Structured output → DB
    │                               │  SSE: analyzing → pattern:found → brief:complete
    └────────┬──────────────────────┘
             │ auto-chain (if automation trigger)
             v
    ┌───────────────────────────────┐
    │  Phase 3: CONTENT GENERATION  │  Existing agents, BETTER input
    │                               │  Input: full insight brief with:
    │  blog-writer gets:            │    - Cross-session evidence
    │    - Pattern narratives        │    - Actual code from sessions
    │    - Story arcs spanning       │    - Terminal output / errors
    │      multiple sessions        │    - Before/after transformations
    │  social-writer gets:          │
    │    - Different angle on same  │  Each writer picks a UNIQUE angle
    │      corpus                   │  No overlap between platforms
    │                               │  SSE: generating → content:created
    └───────────────────────────────┘
             │
             v
    Full observability in Agent Graph
    (every phase, every agent, every tool call visible)
```

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 1](phase-01-corpus-analyzer-agent.md) | Corpus Analyzer Agent — new agent, prompt, MCP tools | TODO |
| [Phase 2](phase-02-scan-analyze-chain.md) | Auto-chain scan → analyze in stream route | TODO |
| [Phase 3](phase-03-content-generation-upgrade.md) | Content generation with rich cross-session input | TODO |
| [Phase 4](phase-04-ui-pipeline-progress.md) | UI: scan progress, dashboard pipeline view | TODO |
| [Phase 5](phase-05-observability-integration.md) | Observability: all phases visible in agent graph | TODO |
| [Phase 6](phase-06-validation.md) | End-to-end functional validation | TODO |

## Key Design Decisions

1. **Corpus analysis replaces per-session extraction for scan-triggered flows** — The automation pipeline's `for (session of sessions) { extractInsight(session) }` loop gets replaced with a single corpus-analyzer call that sees all sessions together.

2. **Per-session extraction preserved as fallback** — For API/programmatic use, `extractInsight({sessionId})` still works. But the primary flow uses corpus analysis.

3. **Scan auto-chains to analysis by default** — `analyzeAfterScan=true` query param. User can opt out with `=false` for quick re-index.

4. **Insight brief is the contract between analysis and content generation** — Structured JSON matching devlog-publisher's insight_brief format. Stored in DB. Content agents read from it, not individual insight rows.

5. **Observability events throughout** — Every phase emits to the event bus. The agent graph shows the full pipeline in real-time.

## Files Changed

### New Files
- `src/lib/ai/agents/corpus-analyzer.ts` — New agent
- `src/lib/ai/prompts/corpus-analysis.ts` — Cross-session analysis prompt
- `src/lib/ai/tools/corpus-tools.ts` — Bulk session tools for the agent
- `src/lib/ai/tools/insight-brief-tools.ts` — Insight brief creation tools

### Modified Files
- `src/app/api/sessions/scan/stream/route.ts` — Auto-chain to analysis
- `src/lib/automation/pipeline.ts` — Use corpus-analyzer instead of per-session loop
- `src/lib/ai/mcp-server-factory.ts` — Register corpus-analyzer tools
- `src/lib/ai/orchestration/tool-registry.ts` — Add corpus-analyzer agent type
- `src/lib/automation/content-generator.ts` — Accept insight brief input
- `src/components/observability/graph-state.ts` — Handle corpus-analysis events

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Corpus analysis prompt too long (many sessions) | HIGH | Summarize sessions first, deep-dive on top N |
| Agent SDK token limits with bulk session data | HIGH | Chunked analysis: summarize → rank → deep-dive |
| Analysis takes too long for SSE response | MEDIUM | Background job with polling, not inline SSE |
| Cross-session patterns are low-quality | MEDIUM | Weighted scoring filters noise, human review in UI |
