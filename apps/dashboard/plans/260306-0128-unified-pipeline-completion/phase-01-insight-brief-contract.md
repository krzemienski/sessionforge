# Phase 1: Build Insight Brief Contract

## Overview
- **Priority:** CRITICAL — load-bearing deliverable
- **Status:** TODO
- **Depends on:** Nothing (this is the foundation)
- **Estimated LOC:** ~120 across 2 files

## Problem

The pipeline severs the connection between corpus analysis and content generation:

1. `corpus-analyzer.ts:67` returns `{ insightCount, text }` where `text` is the full cross-session analysis narrative
2. `pipeline.ts:90-95` calls `analyzeCorpus()` and stores `corpusResult`
3. `pipeline.ts:95` uses `corpusResult.insightCount` for the run record
4. `pipeline.ts:96-98` **DISCARDS** `corpusResult.text` — never forwarded
5. `pipeline.ts:106-116` queries DB for new insight IDs → `newInsightIds = rows.map(row => row.id)` — bare UUIDs only
6. `pipeline.ts:127-132` passes `{ insightIds: newInsightIds }` to `generateContent()` — no narrative context
7. `content-generator.ts:47` builds: `'Write a blog post based on insights "id1", "id2"'` — writers see UUIDs, not evidence

## Target

Content writers receive:
- The full corpus analysis narrative (what patterns were found across sessions)
- For each insight: title, description, composite score, category
- Explicit instructions to fetch code/evidence via `get_insight_details` tool
- Platform-specific angle guidance (blog: deep narrative, social: single surprising finding, etc.)

## Key Insights from Research

1. **Writers already have the tools** — `blog-writer` tool set: `[session, insight, post, skill, github]`. It CAN call `get_insight_details(insightId)` to get full insight data including `codeSnippets` jsonb and `terminalOutput` jsonb. The problem is the prompt never tells it to do so meaningfully.

2. **insights table is rich** — 14 columns including `title`, `description`, `codeSnippets` (jsonb array of `{language, code, context}`), `terminalOutput` (jsonb string array), `compositeScore`, and 6 individual score columns. All queryable via existing `getInsightDetails()` in `insight-tools.ts:39-52`.

3. **No new DB table needed** — The corpus analysis narrative (`corpusResult.text`) is ephemeral context for the current pipeline run. Pass it through as a string parameter. Individual insight data already lives in the `insights` table.

## Related Code Files

### Files to Modify
| File | Lines | Change |
|------|-------|--------|
| `src/lib/automation/content-generator.ts` | 29-34, 42-100, 102-137 | Add `corpusSummary` field, add `buildBriefContext()`, update all 7 `buildUserMessage()` functions |
| `src/lib/automation/pipeline.ts` | 127-132 | Pass `corpusResult?.text` as `corpusSummary` to `generateContent()` |

### Files to Read (dependencies)
| File | Why |
|------|-----|
| `src/lib/ai/tools/insight-tools.ts` | Understand `getInsightDetails()` return shape for building context |
| `src/lib/ai/orchestration/tool-registry.ts:64-76` | Confirm writers have insight tool access |
| `packages/db/src/schema.ts:356-385` | Insight table column definitions |

## Implementation Steps

### Step 1: Add `corpusSummary` to GenerateContentInput

**File:** `src/lib/automation/content-generator.ts:29-34`

Add `corpusSummary?: string` to the input interface:

```typescript
interface GenerateContentInput {
  workspaceId: string;
  contentType: ContentType;
  insightIds?: string[];
  lookbackDays?: number;
  corpusSummary?: string;  // NEW: full analysis narrative from corpus-analyzer
}
```

### Step 2: Create `buildBriefContext()` function

**File:** `src/lib/automation/content-generator.ts` (new function, insert after line 40)

This function fetches insight rows by their IDs and assembles a narrative context string that gets injected into every writer's prompt.

```typescript
async function buildBriefContext(input: GenerateContentInput): Promise<string> {
  const sections: string[] = [];

  // Include corpus analysis narrative if available
  if (input.corpusSummary) {
    sections.push(
      "## Cross-Session Analysis\n" +
      input.corpusSummary
    );
  }

  // Fetch and summarize each insight
  if (input.insightIds?.length) {
    const insightSummaries: string[] = [];
    for (const id of input.insightIds) {
      try {
        const insight = await db.query.insights.findFirst({
          where: and(
            eq(insights.id, id),
            eq(insights.workspaceId, input.workspaceId)
          ),
        });
        if (insight) {
          insightSummaries.push(
            `### ${insight.title} (score: ${insight.compositeScore}/65, category: ${insight.category})\n` +
            `${insight.description}\n` +
            (insight.codeSnippets?.length
              ? `Code evidence: ${insight.codeSnippets.length} snippet(s) available via get_insight_details("${id}")`
              : "") +
            (insight.terminalOutput?.length
              ? `\nTerminal output: ${insight.terminalOutput.length} entries available via get_insight_details("${id}")`
              : "")
          );
        }
      } catch {
        // Skip unavailable insights
      }
    }
    if (insightSummaries.length) {
      sections.push(
        "## Insights from Corpus Analysis\n" +
        insightSummaries.join("\n\n")
      );
    }
  }

  return sections.length
    ? "# Context: Cross-Session Intelligence\n\n" + sections.join("\n\n")
    : "";
}
```

**Key design choices:**
- Fetches insight rows directly (not via MCP tool call) — this runs in Node.js server context, not agent context
- Includes title, score, category, description inline — enough for the writer to understand the pattern
- References code/terminal evidence by ID — tells the writer to use `get_insight_details` for full code, keeping the prompt manageable
- Truncation not needed here because insight descriptions are typically 200-500 chars and we limit to the `newInsightIds` set (typically 2-6 insights per run)

### Step 3: Update `buildUserMessage()` signature

**File:** `src/lib/automation/content-generator.ts:39`

Change `ContentConfig.buildUserMessage` to accept a `briefContext` parameter:

```typescript
interface ContentConfig {
  agentType: AgentType;
  systemPrompt: string;
  buildUserMessage: (input: GenerateContentInput, briefContext: string) => string;
}
```

### Step 4: Rewrite all 7 `buildUserMessage()` implementations

**File:** `src/lib/automation/content-generator.ts:42-100`

Each content type's `buildUserMessage` now receives `briefContext` (the assembled narrative) and includes it in the agent prompt. See Phase 2 for the detailed prompt rewrites.

Summary of changes per type:

| Content Type | Current Prompt Pattern | New Prompt Pattern |
|-------------|----------------------|-------------------|
| `blog_post` | `'Write a blog based on insights "id1", "id2"'` | Brief context + "Write a deep technical blog post based on the cross-session patterns above. For each insight, call get_insight_details to retrieve actual code and terminal output. Tell the story arc across sessions." |
| `twitter_thread` | `'Create a Twitter thread based on insights "id1"'` | Brief context + "Pick the single most surprising finding. Create a thread that developers will share." |
| `linkedin_post` | `'Create a LinkedIn post based on insights "id1"'` | Brief context + "Focus on the professional lesson learned. What would you tell your team?" |
| `devto_post` | `'Write a Dev.to article based on insights "id1"'` | Brief context + "Write a practical tutorial with code examples. Dev.to audience wants reproducible steps." |
| `changelog` | `'Generate a changelog for the last N days'` | Brief context + "Group changes by theme, not by session. Show evolution across the time window." |
| `newsletter` | `'Create a newsletter covering the last N days'` | Brief context + "Curate the top patterns into a digest. Each section covers one cross-session theme." |
| `custom` | `'Write a custom piece based on insights "id1"'` | Brief context + "Create content based on the cross-session patterns. Use insights for evidence." |

### Step 5: Wire `buildBriefContext()` into `generateContent()`

**File:** `src/lib/automation/content-generator.ts:102-118`

```typescript
export async function generateContent(
  input: GenerateContentInput,
): Promise<{ postId: string } | null> {
  const config = CONTENT_CONFIG[input.contentType];
  const briefContext = await buildBriefContext(input);  // NEW

  const mcpServer = createAgentMcpServer(config.agentType, input.workspaceId);

  await runAgent({
    agentType: config.agentType,
    workspaceId: input.workspaceId,
    systemPrompt: config.systemPrompt,
    userMessage: config.buildUserMessage(input, briefContext),  // CHANGED
    mcpServer,
    trackRun: false,
  });

  // ... rest unchanged
}
```

### Step 6: Pass `corpusResult.text` from pipeline.ts

**File:** `src/lib/automation/pipeline.ts:86-132`

Store `corpusResult` in a variable accessible to the generate phase:

```typescript
// Line ~86: declare outside try block
let corpusSummary: string | null = null;

// Line ~90-95: capture text from analysis
try {
  const corpusResult = await analyzeCorpus({
    workspaceId: workspace.id,
    lookbackDays,
    traceId: obs.traceId,
  });
  insightsExtracted = corpusResult.insightCount;
  corpusSummary = corpusResult.text;  // NEW: capture the narrative
} catch {
  // non-fatal
}

// Line ~127-132: pass to generateContent
const generateResult = await generateContent({
  workspaceId: workspace.id,
  contentType,
  insightIds: newInsightIds,
  lookbackDays,
  corpusSummary: corpusSummary ?? undefined,  // NEW
});
```

## Imports Required

**content-generator.ts** needs these new imports (some may already exist):
```typescript
import { db } from "@/lib/db";
import { insights } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
```

Note: `db` and `posts` are already imported. Check if `insights`, `eq`, `and` need adding.

## Success Criteria

- [ ] `GenerateContentInput` has `corpusSummary?: string` field
- [ ] `buildBriefContext()` exists and fetches insight rows by ID
- [ ] All 7 `buildUserMessage()` functions receive and use `briefContext` parameter
- [ ] `pipeline.ts` passes `corpusResult.text` as `corpusSummary`
- [ ] Production build compiles with zero TS errors in modified files
- [ ] Existing manual content creation (without `corpusSummary`) still works

## What This Does NOT Do

- Does not create new MCP tools (not needed — writers already have insight tools)
- Does not create new DB tables (not needed — insights table has all data)
- Does not change the corpus-analyzer agent (it already works correctly)
- Does not change the SSE stream route (it already chains scan → analyze)
- Does not add new agent types (existing writers are sufficient)
