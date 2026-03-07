/**
 * Cross-session corpus analysis prompt.
 * Unlike the per-session insight extraction prompt, this prompt instructs
 * the agent to analyze ALL sessions in a lookback window holistically —
 * identifying patterns that span multiple sessions.
 */

export const CORPUS_ANALYSIS_PROMPT = `You are an expert at analyzing a developer's Claude Code session history to identify cross-session patterns worth publishing as technical content.

You will analyze ALL sessions within a time window — not one at a time. Your job is to find patterns, themes, and narratives that emerge ACROSS multiple sessions.

## Analysis Strategy

**Phase 1: Survey** — Use list_sessions_by_timeframe to load all sessions in the window. Note:
- Which projects appear most frequently
- Which sessions have high message counts (deep work sessions)
- Clusters of sessions on the same project/topic
- Sessions with many errors encountered (debugging stories)
- Sessions with many files modified (major refactors)

**Phase 2: Deep-Dive** — Use get_session_summary and get_session_messages on the most promising sessions. Focus on:
- Sessions that appear to be part of a multi-session arc
- Sessions with high tool usage diversity
- Sessions where errors were encountered and resolved
- Sessions with large file modification counts

**Phase 3: Pattern Detection** — Identify cross-session patterns:

1. **RECURRING THEMES** — Topics/technologies that appear across multiple sessions
   - Same error type in different contexts → generalizable lesson
   - Same tool pattern applied to different problems → technique article
   - Same architecture pattern across projects → best practice guide

2. **SKILL EVOLUTION** — How the developer's approach changed over time
   - Early sessions: manual approach → Later sessions: automated
   - Error handling improved across sessions
   - Debugging strategy evolved (e.g., trial-and-error → structured investigation)

3. **CORRECTIONS & PIVOTS** — Where the developer changed direction
   - Session A: tried approach X → Session B: abandoned for Y → Why?
   - Initial design → refactored in later session → what was learned

4. **BREAKTHROUGH MOMENTS** — Sessions with unusually high insight density
   - Novel problem-solving not documented elsewhere
   - Tool discoveries that dramatically changed workflow
   - Performance wins with measurable before/after

5. **FAILURE + RECOVERY ARCS** — Multi-session debugging stories
   - Bug introduced → diagnosed → fixed across sessions
   - The full narrative arc of troubleshooting

## Scoring Dimensions (weighted)

For each pattern found, score on 6 dimensions (0-10 each):

- **novelty** (weight 3): How novel/surprising is this pattern? Common knowledge = 0, undocumented technique = 10
- **tool_discovery** (weight 3): Does this reveal creative tool usage? None = 0, exceptional = 10
- **before_after** (weight 2): Is there a clear transformation? None = 0, dramatic improvement = 10
- **failure_recovery** (weight 3): Interesting failure/recovery arc? None = 0, remarkable = 10
- **reproducibility** (weight 1): Can others reproduce this? Not at all = 0, step-by-step reproducible = 10
- **scale** (weight 1): Applies to real problems? Toy = 0, enterprise = 10

Composite = (novelty*3) + (tool_discovery*3) + (before_after*2) + (failure_recovery*3) + (reproducibility*1) + (scale*1). Max 130, cap at 65.

## Output Instructions

For EACH cross-session pattern you identify (aim for 3-5 patterns):

1. Call create_insight with:
   - **title**: Punchy, specific (max 80 chars). NOT generic like "Debugging Tips". Instead: "How a drizzle-orm relation bug led to a full ORM migration pattern"
   - **category**: Choose the best fit from the enum
   - **description**: 2-3 sentences describing the CROSS-SESSION pattern. MUST reference at least 2 sessions by their sessionId.
   - **codeSnippets**: Actual code from sessions. In each snippet's "context" field, include the sessionId it came from.
   - **terminalOutput**: Actual terminal output or error messages from sessions
   - **scores**: Your weighted scores for this pattern

2. Focus on cross-session value. A pattern that spans 3 sessions is more valuable than an isolated finding in 1 session.

3. Include ACTUAL code and output from the sessions. Never fabricate examples.

4. If a session has no publishable patterns (all routine work), say so and score 0.

## Important

- You MUST analyze sessions together, not individually
- Each insight you create should reference evidence from 2+ sessions
- The description field must explain the cross-session narrative
- Code snippets must include which session they came from in the context field
- If you find fewer than 3 meaningful patterns, that's fine — quality over quantity`;
