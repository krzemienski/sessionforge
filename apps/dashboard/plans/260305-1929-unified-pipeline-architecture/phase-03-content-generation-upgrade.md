# Phase 3: Content Generation with Rich Cross-Session Input

## Overview
- Priority: HIGH
- Status: TODO
- Depends on: Phase 1, Phase 2

## Problem

Current `generateContent()` receives: `{ workspaceId, contentType, insightIds: ["id1", "id2"] }`

The content agent then fetches each insight individually. It sees isolated facts, not the narrative.

## Target

Content agents receive the full insight brief — cross-session patterns with evidence, story arcs, actual code from multiple sessions, and suggested content angles per platform.

## Changes

### `src/lib/automation/content-generator.ts`

Add a new entry point that accepts a brief:

```typescript
interface GenerateFromBriefInput {
  workspaceId: string;
  contentType: ContentType;
  briefId: string;  // References the stored insight brief
  lookbackDays?: number;
}

// The user message changes from:
// "Write a blog post based on insights X, Y"
// To:
// "Write a blog post. Use get_insight_brief to load the full analysis.
//  Pick the highest-scoring pattern. Your post should:
//  - Reference actual code from the sessions involved
//  - Tell the story arc across multiple sessions
//  - Include before/after evidence where available
//  - Be deeply technical with reproducible techniques"
```

### Content agent prompts

Each content type prompt gets enriched to work with cross-session evidence:

**Blog writer**:
- Lead with the cross-session narrative (not just "I discovered X")
- Include code from multiple sessions showing evolution
- Reference corrections and pivots as learning moments

**Social writer**:
- Pick a DIFFERENT angle than blog (enforced in prompt)
- Focus on the most surprising single finding from the brief

**Changelog writer**:
- Aggregate changes across sessions chronologically
- Group by theme (not by session)

### New MCP tool for content agents

```typescript
// get_insight_brief — allows content agents to load the full analysis
// Already created in Phase 1's insight-brief-tools.ts
// Just needs to be added to content agent tool sets
```

## Implementation Steps

1. [ ] Add `generateFromBrief()` function to content-generator.ts
2. [ ] Update blog/social/changelog prompts to work with cross-session evidence
3. [ ] Add `insight-brief` tool group to blog-writer and social-writer agent tool sets
4. [ ] Wire automation pipeline to use `generateFromBrief()` with the brief from Phase 2
5. [ ] Verify content output references multiple sessions (not single-session insights)

## Success Criteria

- Blog posts reference evidence from 2+ sessions
- Content tells a narrative arc, not isolated facts
- Each content type takes a different angle on the same insight corpus
- Code snippets in posts are traceable to actual sessions
