import { ensureCliAuth } from "@/lib/ai/ensure-cli-auth";
/**
 * Source assembler.
 * Combines user brief, extracted URLs, repo analyses, and session evidence
 * into a unified SourceMaterialPackage, with cross-references identified by Claude.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// Allow Claude SDK subprocess spawning even when running inside a Claude Code session

ensureCliAuth();

import type { ContentBrief } from "./text-processor";
import type { ParsedURL } from "./url-extractor";
import type { RepoAnalysis } from "./repo-analyzer";

/** Session evidence item passed in from the caller (from Phase 2 mining). */
export interface SessionEvidence {
  sessionId: string;
  title: string;
  summary: string;
  relevantExcerpts: string[];
  topics: string[];
}

export interface CrossReference {
  sourceType: "userBrief" | "url" | "repo" | "session";
  sourceIndex: number;
  targetType: "userBrief" | "url" | "repo" | "session";
  targetIndex: number;
  relationship: string;
  description: string;
}

export interface SourceMaterialPackage {
  userBrief: ContentBrief | null;
  externalSources: ParsedURL[];
  repositories: RepoAnalysis[];
  sessionEvidence: SessionEvidence[];
  crossReferences: CrossReference[];
  assembledAt: string;
}

const SYSTEM_PROMPT = `You are a research analyst. Given multiple source materials, identify meaningful cross-references between them.
Respond ONLY with a valid JSON array of cross-reference objects — no markdown fences, no extra text.`;

/** Build a compact text digest for cross-reference analysis. */
function buildDigest(pkg: Omit<SourceMaterialPackage, "crossReferences" | "assembledAt">): string {
  const parts: string[] = [];

  if (pkg.userBrief) {
    parts.push(`## User Brief (index 0)\nThesis: ${pkg.userBrief.thesis}\nKey Points: ${pkg.userBrief.keyPoints.join("; ")}\nConcepts: ${pkg.userBrief.referencedConcepts.join(", ")}`);
  }

  pkg.externalSources.forEach((src, i) => {
    parts.push(`## URL Source (index ${i})\nTitle: ${src.title}\nURL: ${src.url}\nExcerpt: ${src.excerpt}\nCode Blocks: ${src.codeBlocks.length}`);
  });

  pkg.repositories.forEach((repo, i) => {
    parts.push(`## Repository (index ${i})\nName: ${repo.name}\nDescription: ${repo.description}\nTech: ${repo.techStack.join(", ")}\nPatterns: ${repo.relevantPatterns.join("; ")}`);
  });

  pkg.sessionEvidence.forEach((ev, i) => {
    parts.push(`## Session Evidence (index ${i})\nTitle: ${ev.title}\nSummary: ${ev.summary}\nTopics: ${ev.topics.join(", ")}`);
  });

  return parts.join("\n\n");
}

/** Use Claude to identify cross-references between sources. */
async function identifyCrossReferences(
  pkg: Omit<SourceMaterialPackage, "crossReferences" | "assembledAt">
): Promise<CrossReference[]> {
  const totalSources =
    (pkg.userBrief ? 1 : 0) +
    pkg.externalSources.length +
    pkg.repositories.length +
    pkg.sessionEvidence.length;

  if (totalSources < 2) {
    return [];
  }

  const digest = buildDigest(pkg);

  const prompt = `Identify cross-references between these source materials:

${digest.slice(0, 8_000)}

Return a JSON array of cross-references. Each object must have:
{
  "sourceType": "userBrief" | "url" | "repo" | "session",
  "sourceIndex": number,
  "targetType": "userBrief" | "url" | "repo" | "session",
  "targetIndex": number,
  "relationship": "supports" | "contradicts" | "extends" | "implements" | "references" | "related",
  "description": "1 sentence explaining the connection"
}

Only include meaningful connections. Return [] if none found. Maximum 15 cross-references.`;

  let responseText: string | null = null;

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      model: "claude-haiku-4-5-20251001",
      maxTurns: 1,
    },
  })) {
    if ("result" in message) {
      responseText = message.result as string;
    }
  }

  if (!responseText) return [];

  try {
    const cleaned = responseText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is CrossReference => {
        return (
          item !== null &&
          typeof item === "object" &&
          "sourceType" in item &&
          "targetType" in item &&
          "relationship" in item &&
          "description" in item
        );
      })
      .slice(0, 15);
  } catch {
    return [];
  }
}

/** Assemble all sources into a unified SourceMaterialPackage. */
export async function assembleSourceMaterial(params: {
  userBrief: ContentBrief | null;
  externalSources: ParsedURL[];
  repositories: RepoAnalysis[];
  sessionEvidence: SessionEvidence[];
}): Promise<SourceMaterialPackage> {
  const base = {
    userBrief: params.userBrief,
    externalSources: params.externalSources,
    repositories: params.repositories,
    sessionEvidence: params.sessionEvidence,
  };

  // Identify cross-references (failure is non-fatal)
  let crossReferences: CrossReference[] = [];
  try {
    crossReferences = await identifyCrossReferences(base);
  } catch {
    // Cross-reference identification is best-effort
  }

  return {
    ...base,
    crossReferences,
    assembledAt: new Date().toISOString(),
  };
}
