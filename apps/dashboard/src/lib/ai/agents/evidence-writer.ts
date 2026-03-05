/**
 * Evidence-writer agent.
 * Generates first-person narrative content grounded in real session evidence
 * and external source material. Every claim must be cited.
 */

import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";
import { setSourceMaterial, clearSourceMaterial } from "../tools/ingestion-tools";
import type { SourceMaterialPackage } from "@/lib/ingestion/source-assembler";

// ── System prompt ──────────────────────────────────────────────────────────

const EVIDENCE_WRITER_SYSTEM_PROMPT = `You are an evidence-based technical writer. You generate first-person narrative content that is grounded entirely in real evidence — session transcripts, external sources, and repository analyses.

## Core Rules

1. **Every claim must be cited.** Use inline citations:
   - Session evidence: [Session: project-name, YYYY-MM-DD]
   - External source: [Source: article-title or URL]
   - Repository: [Repo: repo-name]
   - User brief: [Brief]

2. **First-person narrative voice.** Write as the person who actually did the work:
   - "Here's what I found when I actually tried this..."
   - "I ran into this problem when..."
   - "After testing three approaches, I discovered..."

3. **Zero fabrication.** If you don't have evidence for a claim, don't make it. Use mine_sessions to search for relevant evidence before writing each section.

4. **Required sections** (every generated post must include):
   - An introduction with your thesis
   - Body sections covering the main topic with cited evidence
   - **## Critical Analysis** — Compare claims vs evidence: what the theory says vs what actually happened
   - **## What to Rebuild** — Evidence-backed, specific recommendations for what to do differently

5. **Narrative arc options** (choose based on content):
   - *Journey*: chronological account of solving a problem
   - *Thesis-evidence*: make a claim, then prove it with evidence
   - *Comparison*: compare approaches with real data from sessions
   - *Evolution*: show how an approach changed over time

## Workflow

1. Call get_source_material() to understand what sources are available
2. Call get_content_brief() to understand the user's thesis and key points
3. Call mine_sessions(topic) to find relevant session evidence
4. Review evidence classifications — use 'confirmation', 'discovery', and 'failure' items especially
5. Plan your narrative arc based on the evidence shape
6. Write section by section, citing as you go
7. Write ## Critical Analysis comparing stated vs observed behavior
8. Write ## What to Rebuild with specific, evidence-backed recommendations
9. Call create_post() with the complete markdown

## Quality Standards
- Minimum 800 words for blog posts
- At least 3 inline citations in the body
- Critical Analysis section must reference at least 2 specific evidence items
- What to Rebuild must have at least 3 concrete recommendations`;

// ── Input ──────────────────────────────────────────────────────────────────

export interface EvidenceWriterInput {
  workspaceId: string;
  topic: string;
  sourceMaterial?: SourceMaterialPackage | null;
  narrativeArc?: string;
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function streamEvidenceWriter(
  input: EvidenceWriterInput
): Promise<Response> {
  // Inject source material into the ingestion tool context before the agent runs
  if (input.sourceMaterial) {
    setSourceMaterial(input.workspaceId, input.sourceMaterial);
  }

  const mcpServer = createAgentMcpServer("evidence-writer", input.workspaceId);

  const hasSources = input.sourceMaterial && (
    input.sourceMaterial.externalSources.length > 0 ||
    input.sourceMaterial.repositories.length > 0 ||
    input.sourceMaterial.userBrief !== null
  );

  const arcInstruction = input.narrativeArc
    ? `\n\nUse the "${input.narrativeArc}" narrative arc to structure the content.`
    : "";

  const userMessage = hasSources
    ? `Write an evidence-based blog post about: "${input.topic}"

You have source material available — call get_source_material() first to see what's loaded, then mine_sessions("${input.topic}") to find session evidence. Combine both to write a comprehensive, first-person narrative with inline citations. When done, call create_post() with the complete markdown.${arcInstruction}`
    : `Write an evidence-based blog post about: "${input.topic}"

Mine your session history for evidence: call mine_sessions("${input.topic}") to find relevant sessions, then write a first-person narrative with inline citations. When done, call create_post() with the complete markdown.${arcInstruction}`;

  const response = runAgentStreaming(
    {
      agentType: "evidence-writer",
      workspaceId: input.workspaceId,
      systemPrompt: EVIDENCE_WRITER_SYSTEM_PROMPT,
      userMessage,
      mcpServer,
      maxTurns: 20,
    },
    {
      topic: input.topic,
      workspaceId: input.workspaceId,
      hasSourceMaterial: !!hasSources,
    }
  );

  // Clean up source material after streaming starts (it will be read during streaming)
  // Use a timeout to allow the agent to start before cleanup
  setTimeout(() => {
    clearSourceMaterial(input.workspaceId);
  }, 5 * 60 * 1000); // 5 minute TTL

  return response;
}
