# Unified Pipeline Completion — 2.55/5.0 to 5.0/5.0

## Problem Statement

The unified pipeline architecture plan (`260305-1929-unified-pipeline-architecture`) is ~35% implemented. The **corpus analyzer agent works** (creates rich cross-session insights in DB), but its output is **discarded** before reaching content writers. Writers receive bare UUID strings like `"Write a blog post based on insights \"id1\", \"id2\""` instead of cross-session narratives with evidence, code, and story arcs.

The severed pipeline:
```
corpus-analyzer → creates insights (rich: title, description, code, scores)
                ↓
pipeline.ts:116 → newInsightIds = rows.map(row => row.id)  // DISCARDS everything
                ↓
content-generator.ts:47 → 'Write a blog post based on insights "id1", "id2"'  // BARE UUIDs
                ↓
blog-writer agent → has get_insight_details tool but receives no instruction to use it deeply
```

## Target State

```
corpus-analyzer → creates insights (rich: title, description, code, scores)
                ↓
pipeline.ts → passes corpusResult.text + newInsightIds + lookbackDays
                ↓
content-generator.ts → buildBriefContext() fetches insights, assembles narrative
                ↓
buildUserMessage() includes:
  - Cross-session pattern narratives from corpus analysis
  - Individual insight titles, descriptions, scores
  - Instruction to fetch code/evidence via get_insight_details
  - Platform-specific angle guidance
                ↓
blog-writer agent → sees full cross-session story, writes evidence-based content
```

## Architecture: Current vs Target (content-generator.ts)

### Current GenerateContentInput
```typescript
interface GenerateContentInput {
  workspaceId: string;
  contentType: ContentType;
  insightIds?: string[];      // ← bare UUIDs, no narrative
  lookbackDays?: number;
}
```

### Target GenerateContentInput
```typescript
interface GenerateContentInput {
  workspaceId: string;
  contentType: ContentType;
  insightIds?: string[];
  lookbackDays?: number;
  corpusSummary?: string;     // ← NEW: full analysis narrative from corpus-analyzer
}
```

## Key Design Decisions

1. **No new DB table** — Enrich the existing flow. `insights` table already stores title, description, codeSnippets (jsonb), terminalOutput (jsonb), 6 score columns, compositeScore. All queryable.

2. **No new `generateFromBrief()` function** — The original plan proposed a separate entry point with `briefId`. Simpler approach: enrich `buildUserMessage()` in the existing `generateContent()` by fetching insight data inline and including `corpusSummary` from the pipeline.

3. **No `insight_briefs` table** — The corpus-analyzer already returns `{insightCount, text}` where `text` is the full analysis narrative. Pass `text` through as `corpusSummary`. Individual insight details fetched from existing `insights` table.

4. **Writers already have insight tools** — `blog-writer` has `[session, insight, post, skill, github]` tool groups. It can already call `get_insight_details` and `get_top_insights`. The fix is making the prompt TELL it to use them with specific IDs and context.

5. **Backward compatible** — `insightIds` and `corpusSummary` are both optional. Existing callers (manual content creation) continue working. Only the automation pipeline passes the enriched context.

## Phases

| Phase | Description | Priority | Estimated LOC | Status |
|-------|-------------|----------|---------------|--------|
| [Phase 1](phase-01-insight-brief-contract.md) | Build insight brief contract (content-generator + pipeline) | CRITICAL | ~120 | TODO |
| [Phase 2](phase-02-enriched-prompts.md) | Enrich content type prompts for cross-session narratives | HIGH | ~100 | TODO |
| [Phase 3](phase-03-observability-graph.md) | Add corpus-analyzer to observability graph | MEDIUM | ~30 | TODO |
| [Phase 4](phase-04-corpus-progress-ui.md) | Corpus-aware progress UI in scan components | LOW | ~40 | TODO |
| [Phase 5](phase-05-validation.md) | End-to-end functional validation (6 gates) | HIGH | 0 (validation) | TODO |

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `buildBriefContext()` DB query slow with many insights | LOW | Query limited to newInsightIds (typically 2-6 per run) |
| `corpusSummary` too long for prompt context | MEDIUM | Truncate to 2000 chars; insight details fetched via tools |
| Agent ignores enriched context, writes generic content | MEDIUM | Explicit prompt instructions with numbered steps |
| Backward compat break for manual content creation | LOW | All new fields optional; existing callers unaffected |

## Files Changed Summary

### Modified Files (Phase 1-2)
- `src/lib/automation/content-generator.ts` — Add `corpusSummary` to input, `buildBriefContext()`, enrich all 7 `buildUserMessage()` functions
- `src/lib/automation/pipeline.ts` — Pass `corpusResult.text` to `generateContent()`
- `src/lib/ai/prompts/blog/technical.ts` — Add cross-session narrative instructions
- `src/lib/ai/prompts/social/twitter-thread.ts` — Add cross-session angle instructions
- `src/lib/ai/prompts/social/linkedin-post.ts` — Add cross-session angle instructions
- `src/lib/ai/prompts/changelog.ts` — Add multi-session grouping instructions
- `src/lib/ai/prompts/newsletter.ts` — Add cross-session digest instructions

### Modified Files (Phase 3)
- `src/components/observability/graph-state.ts` — Add ANALYSIS_AGENTS set with corpus-analyzer

### No New Files Required
The original plan called for `corpus-tools.ts` and `insight-brief-tools.ts`. These are **not needed** because:
- Corpus-analyzer already has `[session, insight]` tools which cover all its needs
- Content writers already have `get_insight_details` and `get_top_insights` via the `insight` tool group
- No new MCP tools are required — the fix is on the prompt/context side

## Dependency Graph

```
Phase 1 (contract) ─────┐
                         ├──→ Phase 5 (validation)
Phase 2 (prompts) ──────┘

Phase 3 (observability) ─────→ Phase 5 (validation)

Phase 4 (UI) ───────────────→ Phase 5 (validation)
```

Phases 1+2 can be done together (same files). Phase 3 and 4 are independent of each other.
