# Phase 2: Enrich Content Type Prompts

## Overview
- **Priority:** HIGH
- **Status:** TODO
- **Depends on:** Phase 1 (buildBriefContext + corpusSummary wiring)
- **Estimated LOC:** ~100 across 2 files

## Problem

Phase 1 assembles the `briefContext` string and passes it to `buildUserMessage()`. But the current `buildUserMessage()` implementations don't know what to do with it — they still construct bare-UUID prompts. Each content type needs a rewritten prompt that:

1. Includes the `briefContext` narrative (cross-session patterns + insight summaries)
2. Gives platform-specific angle guidance (blog: deep narrative, twitter: single surprising finding, etc.)
3. Explicitly instructs the agent to call `get_insight_details(insightId)` for full code/terminal evidence
4. Maintains backward compatibility when `briefContext` is empty (manual content creation)

## Current State (all 7 buildUserMessage functions)

| Content Type | Current Prompt (content-generator.ts) | System Prompt File |
|---|---|---|
| `blog_post` | `'Write a blog post based on insights "id1", "id2". First fetch each insight...'` | `prompts/blog/technical.ts` (21 lines) |
| `twitter_thread` | `'Create a Twitter thread based on the insights "id1". First fetch...'` | `prompts/social/twitter-thread.ts` (19 lines) |
| `linkedin_post` | `'Create a LinkedIn post based on the insights "id1". First fetch...'` | `prompts/social/linkedin-post.ts` (22 lines) |
| `devto_post` | `'Write a Dev.to article based on insights "id1"...'` | Reuses `prompts/blog/technical.ts` |
| `changelog` | `'Generate a changelog for the last N days. First use list_sessions...'` | `prompts/changelog.ts` (28 lines) |
| `newsletter` | `'Create a newsletter digest covering the last N days. Use insights...'` | `prompts/newsletter.ts` (83 lines) |
| `custom` | `'Write a custom content piece based on insights "id1"...'` | Reuses `prompts/blog/technical.ts` |

## Related Code Files

### Files to Modify
| File | Lines | Change |
|------|-------|--------|
| `src/lib/automation/content-generator.ts` | 42-99 | Rewrite all 7 `buildUserMessage` lambdas to accept and use `briefContext` |

### Files to Read (context for prompt design)
| File | Why |
|------|-----|
| `src/lib/ai/prompts/blog/technical.ts` | Current blog system prompt — structure guidance |
| `src/lib/ai/prompts/social/twitter-thread.ts` | Twitter format constraints (280 chars, numbering) |
| `src/lib/ai/prompts/social/linkedin-post.ts` | LinkedIn tone and structure rules |
| `src/lib/ai/prompts/changelog.ts` | Changelog grouping format |
| `src/lib/ai/prompts/newsletter.ts` | Newsletter JSON output schema (83 lines, complex) |
| `src/lib/ai/orchestration/tool-registry.ts` | Confirms which tools each writer agent has access to |

## Implementation Steps

### Step 1: Update ContentConfig interface

Already done in Phase 1 Step 3:
```typescript
buildUserMessage: (input: GenerateContentInput, briefContext: string) => string;
```

### Step 2: Rewrite blog_post buildUserMessage

```typescript
blog_post: {
  agentType: "blog-writer",
  systemPrompt: BLOG_TECHNICAL_PROMPT,
  buildUserMessage: (input, briefContext) => {
    const ids = input.insightIds?.join('", "') ?? "";
    const base = briefContext
      ? `${briefContext}\n\n---\n\n`
      : "";
    return `${base}Write a deep technical blog post based on the cross-session patterns above.

Steps:
1. For each insight ID ("${ids}"), call get_insight_details to retrieve the full code snippets and terminal output.
2. Identify the narrative arc across sessions — what problem evolved, what was tried, what worked.
3. Use real code from the insights as inline examples (with syntax highlighting).
4. Structure: Problem → Approach → Key Decisions → Results → Takeaways.
5. Save the post with create_post using content_type "blog_post".

The story should connect sessions into a coherent journey, not summarize each session independently.`;
  },
},
```

**Design rationale:** The `briefContext` block (from `buildBriefContext()`) already contains insight titles, scores, categories, and descriptions. The user message adds the *instructions* for how to use that context. When `briefContext` is empty (manual creation), the prompt degrades to a bare-IDs version that still works.

### Step 3: Rewrite twitter_thread buildUserMessage

```typescript
twitter_thread: {
  agentType: "social-writer",
  systemPrompt: TWITTER_THREAD_PROMPT,
  buildUserMessage: (input, briefContext) => {
    const ids = input.insightIds?.join('", "') ?? "";
    const base = briefContext
      ? `${briefContext}\n\n---\n\n`
      : "";
    return `${base}Create a Twitter thread about the most surprising finding from the insights above.

Steps:
1. Review the insight summaries. Pick the ONE finding with the highest novelty or most unexpected outcome.
2. Call get_insight_details("${ids.split('", "')[0] || ""}") to get the real code/terminal output for that insight.
3. Build a 7-12 tweet thread: Hook → Build the story → Code snippet → Takeaway → CTA.
4. Save with create_post using content_type "twitter_thread".

Focus on a single insight. Depth beats breadth on Twitter.`;
  },
},
```

### Step 4: Rewrite linkedin_post buildUserMessage

```typescript
linkedin_post: {
  agentType: "social-writer",
  systemPrompt: LINKEDIN_PROMPT,
  buildUserMessage: (input, briefContext) => {
    const ids = input.insightIds?.join('", "') ?? "";
    const base = briefContext
      ? `${briefContext}\n\n---\n\n`
      : "";
    return `${base}Create a LinkedIn post about the professional lesson from the cross-session patterns above.

Steps:
1. From the insight summaries, identify the lesson a team lead would share — a process improvement, an architectural decision, or a debugging approach.
2. Call get_insight_details for the most relevant insight to get supporting evidence.
3. Frame it as "here's what I learned" — professional but human, not corporate.
4. Save with create_post using content_type "linkedin_post".

LinkedIn audience cares about the "why" and the team impact, not just the code.`;
  },
},
```

### Step 5: Rewrite devto_post buildUserMessage

```typescript
devto_post: {
  agentType: "blog-writer",
  systemPrompt: BLOG_TECHNICAL_PROMPT,
  buildUserMessage: (input, briefContext) => {
    const ids = input.insightIds?.join('", "') ?? "";
    const base = briefContext
      ? `${briefContext}\n\n---\n\n`
      : "";
    return `${base}Write a Dev.to tutorial based on the cross-session patterns above.

Steps:
1. For each insight ID ("${ids}"), call get_insight_details to get code snippets and terminal output.
2. Structure as a practical how-to: Problem → Step-by-step solution → Working code → Gotchas.
3. Dev.to readers want reproducible steps — include all imports, config, and setup.
4. Save with create_post using content_type "devto_post".

Prioritize code completeness. Every snippet should be copy-pasteable.`;
  },
},
```

### Step 6: Rewrite changelog buildUserMessage

```typescript
changelog: {
  agentType: "changelog-writer",
  systemPrompt: CHANGELOG_PROMPT,
  buildUserMessage: (input, briefContext) => {
    const days = input.lookbackDays ?? 7;
    const base = briefContext
      ? `${briefContext}\n\n---\n\n`
      : "";
    return `${base}Generate a changelog for the last ${days} days.

Steps:
1. Use list_sessions_by_timeframe to get all sessions in the window.
2. Group changes by THEME (from the cross-session analysis above), not by individual session.
3. For each theme, call get_session_summary on the most representative sessions.
4. Show the evolution: what started as X, became Y, and landed as Z.
5. Save with create_post using content_type "changelog".

The cross-session patterns above reveal the themes. Use them as your grouping headers.`;
  },
},
```

### Step 7: Rewrite newsletter buildUserMessage

```typescript
newsletter: {
  agentType: "newsletter-writer",
  systemPrompt: NEWSLETTER_PROMPT,
  buildUserMessage: (input, briefContext) => {
    const days = input.lookbackDays ?? 7;
    const ids = input.insightIds?.join('", "') ?? "";
    const base = briefContext
      ? `${briefContext}\n\n---\n\n`
      : "";
    return `${base}Create a newsletter digest covering the last ${days} days.

Steps:
1. The cross-session analysis above identifies the key patterns. Use each pattern as a newsletter section.
2. For each insight ("${ids}"), call get_insight_details to get real code for the Code Spotlight.
3. Curate the top 3 patterns into highlights. Each should tell a mini-story with real evidence.
4. Lessons learned should come from the actual insight descriptions, not generic advice.
5. Save with create_post using content_type "newsletter".

Each section should cover one cross-session theme, not summarize individual sessions.`;
  },
},
```

### Step 8: Rewrite custom buildUserMessage

```typescript
custom: {
  agentType: "blog-writer",
  systemPrompt: BLOG_TECHNICAL_PROMPT,
  buildUserMessage: (input, briefContext) => {
    const ids = input.insightIds?.join('", "') ?? "";
    const base = briefContext
      ? `${briefContext}\n\n---\n\n`
      : "";
    return `${base}Create content based on the cross-session patterns above.

Steps:
1. For each insight ID ("${ids}"), call get_insight_details to get code and terminal output.
2. Synthesize the patterns into a coherent narrative with real evidence.
3. Save with create_post using content_type "custom".

Use the insight scores to prioritize: higher-scored insights should get more coverage.`;
  },
},
```

## Backward Compatibility

When `briefContext` is an empty string (no `corpusSummary`, no insight rows found), the `base` variable is `""` and the prompt degrades to instructions-only — functionally equivalent to the current behavior but with better structure.

Manual content creation (user clicks "New Content" in the UI) calls `generateContent()` without `corpusSummary`. Phase 1's `buildBriefContext()` will still attempt to fetch insight rows by ID if `insightIds` are provided, so even manual creation gets enriched prompts when insight IDs are available.

## Success Criteria

- [ ] All 7 `buildUserMessage` functions accept `(input, briefContext)` signature
- [ ] Each function prepends `briefContext` when non-empty
- [ ] Each function includes platform-specific angle guidance
- [ ] Each function instructs agent to call `get_insight_details` with specific IDs
- [ ] Prompts degrade gracefully when `briefContext` is empty
- [ ] Production build compiles with zero TS errors

## What This Does NOT Do

- Does not modify system prompts (`BLOG_TECHNICAL_PROMPT`, etc.) — those define the agent's identity/style, not the per-request context
- Does not change agent types or tool access — writers already have `get_insight_details`
- Does not add new prompt files — all changes are in the `buildUserMessage` lambdas within `content-generator.ts`
