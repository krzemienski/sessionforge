# Phase 6: End-to-End Functional Validation

## Overview
- Priority: CRITICAL
- Status: TODO
- Depends on: All previous phases

## Validation Protocol

### VG6.1: Scan triggers analysis
- Click "Scan Now" on dashboard
- SSE stream shows scanning → indexing → analyzing phases
- Analysis completes with pattern count > 0
- Evidence: Screenshot of scan progress + SSE curl output

### VG6.2: Cross-session insights
- Query insights table after scan
- At least one insight references 2+ sessions
- Insight has actual code snippets from sessions
- Evidence: psql query showing multi-session insight

### VG6.3: Content generation from brief
- Trigger content generation from insight brief
- Blog post references evidence from multiple sessions
- Post contains actual code from sessions (not fabricated)
- Evidence: Post content showing multi-session references

### VG6.4: Observability graph
- Navigate to /observability during active scan
- Graph shows: session-scan → corpus-analyzer → content agents
- Event log shows tool calls (list_all_sessions, create_insight_brief)
- Evidence: Screenshot of graph during pipeline execution

### VG6.5: Pipeline resilience
- Analysis failure doesn't break scan
- Set `analyzeAfterScan=false` skips analysis
- Scan completes normally in both cases
- Evidence: curl with analyzeAfterScan=false returns scan results without analysis

### VG6.6: Automation pipeline upgraded
- Create automation trigger
- Trigger executes unified pipeline (corpus analysis, not per-session)
- Produces content from cross-session patterns
- Evidence: automation_runs row showing corpus analysis path

## Success Criteria

ALL six gates must PASS with cited evidence before this plan is considered complete.
