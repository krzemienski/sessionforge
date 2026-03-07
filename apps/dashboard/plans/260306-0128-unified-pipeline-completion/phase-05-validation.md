# Phase 5: End-to-End Functional Validation

## Overview
- **Priority:** HIGH (after implementation)
- **Status:** TODO
- **Depends on:** Phase 1 + Phase 2 (minimum), Phase 3 optional, Phase 4 optional
- **Estimated LOC:** 0 (validation only, no code changes)

## Purpose

Validate that the complete pipeline — from session scan through corpus analysis to content generation — produces content that references cross-session patterns with real evidence. This is not a test suite; it's a functional walkthrough with evidence capture.

## Prerequisites

Before running validation:
1. Dev server running (`bun next dev` from `apps/dashboard/`)
2. At least 1 workspace with 3+ scanned sessions in the database
3. At least 2 sessions should share overlapping tools/patterns (for cross-session detection)
4. Logged into the app with a valid session

## Validation Gates

### VG5.1: Pipeline Passes corpusSummary

**What to verify:** `pipeline.ts` passes `corpusResult.text` to `generateContent()` as `corpusSummary`.

**How:**
1. Add a temporary `console.log` in `pipeline.ts` after the corpus analysis call:
   ```typescript
   console.log("[VG5.1] corpusSummary length:", corpusSummary?.length ?? "null");
   ```
2. Trigger a pipeline run (Automation page → Run Pipeline or via API)
3. Check server logs for the log line
4. **PASS:** `corpusSummary length: <number>` (non-null, non-zero)
5. **FAIL:** `corpusSummary length: null` or missing log line

**Evidence:** Screenshot of server log showing corpusSummary length.

### VG5.2: buildBriefContext Assembles Insight Data

**What to verify:** `buildBriefContext()` fetches insight rows and returns a non-empty context string.

**How:**
1. Add a temporary `console.log` in `content-generator.ts` after `buildBriefContext()`:
   ```typescript
   const briefContext = await buildBriefContext(input);
   console.log("[VG5.2] briefContext preview:", briefContext.substring(0, 200));
   ```
2. Trigger content generation (New Content → Blog Post with insight IDs, or pipeline run)
3. Check server logs for the preview
4. **PASS:** Log shows context with `# Context: Cross-Session Intelligence` header, insight titles, scores
5. **FAIL:** Empty string or missing context sections

**Evidence:** Screenshot of server log showing briefContext preview with insight titles.

### VG5.3: Writer Agent Receives Enriched Prompt

**What to verify:** The `userMessage` passed to `runAgent()` contains the full briefContext + platform-specific instructions.

**How:**
1. Add a temporary `console.log` in `content-generator.ts` before `runAgent()`:
   ```typescript
   const userMessage = config.buildUserMessage(input, briefContext);
   console.log("[VG5.3] userMessage length:", userMessage.length, "starts with context:", userMessage.startsWith("# Context:"));
   ```
2. Trigger content generation
3. **PASS:** `userMessage length: <500+>`, `starts with context: true`
4. **FAIL:** Short message, no context prefix

**Evidence:** Screenshot of server log.

### VG5.4: Generated Content References Cross-Session Patterns

**What to verify:** The blog post / content piece created by the agent contains references to multiple sessions, patterns, or cross-session themes.

**How:**
1. After pipeline run completes, open the most recent post in the content editor
2. Read the generated content
3. Look for:
   - References to patterns found "across sessions" or "in multiple sessions"
   - Real code snippets (from `get_insight_details` calls)
   - Insight titles or descriptions embedded in the narrative
   - Score references or category mentions
4. **PASS:** Content mentions 2+ sessions, includes code evidence, references specific patterns
5. **FAIL:** Generic content with no cross-session references, or content that reads like "Write a blog post based on insights id1, id2"

**Evidence:** Screenshot of generated content in editor showing cross-session references.

### VG5.5: Backward Compatibility — Manual Content Creation

**What to verify:** Creating content manually (without pipeline, without corpusSummary) still works.

**How:**
1. Navigate to New Content page
2. Select "Blog Post" content type
3. Click Generate (without running pipeline first — no corpusSummary in play)
4. Wait for generation to complete
5. **PASS:** Content is generated successfully (may be generic, but no errors)
6. **FAIL:** Error, crash, or "undefined" in generated content

**Evidence:** Screenshot of successfully generated manual content.

### VG5.6: Observability Graph Shows Corpus-Analyzer (Phase 3 only)

**What to verify:** The observability graph renders corpus-analyzer as an "analysis" type node, visually distinct from generic agent nodes.

**How:**
1. Navigate to the Observability page
2. Trigger a scan with analysis (Sessions → Scan with analyzeAfterScan=true)
3. Watch the graph populate
4. Find the corpus-analyzer node
5. **PASS:** Node renders with "analysis" classification (distinct color/shape from generic "agent" nodes)
6. **FAIL:** Node renders as generic "agent" or doesn't appear

**Evidence:** Screenshot of observability graph with corpus-analyzer node visible.

## Validation Sequence

```
VG5.1 (pipeline wiring) → VG5.2 (brief assembly) → VG5.3 (prompt enrichment)
                                                              ↓
VG5.5 (backward compat) ←←←←←←←←←←←←←←←←←←←←←←←←← VG5.4 (content quality)
                                                              ↓
                                                      VG5.6 (observability)
```

Run VG5.1-VG5.3 first (they verify the data flow). VG5.4 is the highest-value gate (does the content actually improve?). VG5.5 checks we didn't break anything. VG5.6 is optional (Phase 3 dependent).

## Cleanup After Validation

Remove all temporary `console.log` lines added for VG5.1-VG5.3:
- `pipeline.ts`: Remove `[VG5.1]` log
- `content-generator.ts`: Remove `[VG5.2]` and `[VG5.3]` logs

## Success Criteria

- [ ] VG5.1: PASS — corpusSummary flows from pipeline to generator
- [ ] VG5.2: PASS — briefContext contains insight titles, scores, categories
- [ ] VG5.3: PASS — userMessage is enriched (500+ chars, starts with context)
- [ ] VG5.4: PASS — generated content references cross-session patterns with evidence
- [ ] VG5.5: PASS — manual content creation still works without errors
- [ ] VG5.6: PASS — corpus-analyzer node visible in observability graph (Phase 3 only)
- [ ] All temporary console.log lines removed after validation
