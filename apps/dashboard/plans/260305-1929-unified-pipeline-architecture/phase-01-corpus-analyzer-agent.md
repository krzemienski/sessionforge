# Phase 1: Corpus Analyzer Agent

## Overview
- Priority: CRITICAL — this is the core missing piece
- Status: TODO
- Estimated files: 4 new, 2 modified

## Key Insight

The current `insight-extractor` agent says: "Analyze session X and extract the most valuable insight."

The new `corpus-analyzer` agent says: "Here are summaries of 47 sessions from the last 30 days across 5 projects. Identify the cross-session patterns, recurring themes, skill evolution, corrections, and breakthrough moments. Score and rank them."

## New Files

### `src/lib/ai/agents/corpus-analyzer.ts`

```typescript
// Orchestrates the two-phase analysis:
// 1. Bulk load all session summaries in window
// 2. Deep-dive into top sessions for evidence extraction
// 3. Cross-session pattern detection
// 4. Create structured insight brief

export async function analyzeCorpus(input: {
  workspaceId: string;
  lookbackDays: number;
  topicFilter?: string;
  traceId?: string;
}): Promise<{ briefId: string; insightCount: number }>
```

**Two-phase approach to handle token limits:**
1. **Summary phase**: Load all session summaries (compact: sessionId, title, project, date, messageCount, toolsUsed). This fits in context even for 100+ sessions.
2. **Deep-dive phase**: Agent selects top 10-15 sessions to deep-dive via `get_session_messages`. Extracts actual code snippets, terminal output, error messages.

### `src/lib/ai/prompts/corpus-analysis.ts`

Prompt structure (modeled on devlog-publisher's insight extraction):

```
You are analyzing a developer's Claude Code session history to identify
cross-session patterns worth publishing as technical content.

You have access to {N} sessions from the last {lookbackDays} days across
{projectCount} projects.

## What to Look For (Cross-Session Patterns)

1. RECURRING THEMES — Topics/technologies that appear across multiple sessions
   - Same error in different contexts → generalizable lesson
   - Same tool pattern applied to different problems → technique article
   - Same architecture pattern across projects → best practice

2. SKILL EVOLUTION — How the developer's approach changed over time
   - Early sessions: manual approach → Later sessions: automated
   - Error handling improved across sessions
   - Debugging strategy evolved (console.log → structured observability)

3. CORRECTIONS & PIVOTS — Where the developer changed direction
   - Session A: tried approach X → Session B: abandoned for Y → Why?
   - Initial design → refactored in later session → what was learned

4. BREAKTHROUGH MOMENTS — Sessions with unusually high insight density
   - Novel problem-solving that hasn't been documented elsewhere
   - Tool discoveries that dramatically changed workflow
   - Performance wins with measurable before/after

5. FAILURE + RECOVERY ARCS — Multi-session debugging stories
   - Bug introduced → diagnosed → fixed across sessions
   - The full narrative of troubleshooting

## Scoring (6 dimensions, weighted)
- Novel problem-solving (3x)
- Tool/pattern discovery (3x)
- Before/after transformation (2x)
- Failure + recovery (3x)
- Reproducibility (1x)
- Scale/performance (1x)

## Output: Structured Insight Brief
For each pattern found (aim for 3-5), produce:
- title: Punchy, specific (max 80 chars)
- pattern_type: recurring_theme | skill_evolution | correction_pivot | breakthrough | failure_recovery
- sessions_involved: [sessionId, sessionId, ...] — MUST reference 2+ sessions
- narrative: 2-3 sentence story arc
- evidence: { code_snippets: [...], terminal_output: [...], errors: [...] }
- scores: { novelty, tool_discovery, before_after, failure_recovery, reproducibility, scale }
- content_angles: ["blog angle", "twitter angle", "linkedin angle"]

Use create_insight_brief to save the structured output.
```

### `src/lib/ai/tools/corpus-tools.ts`

New MCP tools for corpus-level analysis:

```typescript
// list_all_sessions_in_window — Returns compact summaries of ALL sessions
// Input: { lookbackDays: number, projectFilter?: string }
// Output: Array of { sessionId, title, project, startedAt, messageCount, toolsUsed, filesModified }
// This is a BULK tool — returns all sessions, not paginated

// get_session_cluster — Returns sessions grouped by topic/project
// Input: { lookbackDays: number }
// Output: { clusters: [{ topic, sessions: [...] }] }
```

### `src/lib/ai/tools/insight-brief-tools.ts`

```typescript
// create_insight_brief — Saves structured cross-session analysis
// Input: { patterns: [...], sessionCount, lookbackDays, topInsights: [...] }
// Output: { briefId: string }
// Stores in a new `insight_briefs` table or as JSON in insights table

// get_insight_brief — Retrieves a stored brief for content generation
// Input: { briefId: string }
// Output: Full structured brief
```

## Modified Files

### `src/lib/ai/orchestration/tool-registry.ts`
- Add `"corpus-analyzer"` to `AgentType` union
- Add tool set: `["session", "insight", "corpus", "insight-brief"]`

### `src/lib/ai/mcp-server-factory.ts`
- Import and register `handleCorpusTool` and `handleInsightBriefTool`
- Add tool name → group mappings for new tools
- Add `"corpus-analyzer"` to `AGENT_TOOL_GROUPS`

## Implementation Steps

1. [ ] Create `corpus-analysis.ts` prompt with cross-session pattern detection
2. [ ] Create `corpus-tools.ts` with bulk session loading tools
3. [ ] Create `insight-brief-tools.ts` for structured output storage
4. [ ] Create `corpus-analyzer.ts` agent with two-phase analysis
5. [ ] Register new agent type and tools in tool-registry and mcp-server-factory
6. [ ] Verify build compiles

## Success Criteria

- corpus-analyzer agent can load 50+ session summaries in one call
- Agent identifies patterns that span 2+ sessions (not single-session insights)
- Structured insight brief contains actual code/output evidence
- Scoring matches devlog-publisher's 6-dimension weighted system
