/**
 * Evidence classifier — uses Anthropic SDK to classify session search results
 * into typed evidence categories relevant to a given topic.
 *
 * Batches all results into a single prompt to reduce API round-trips.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { getHaikuModel } from "@/lib/ai/orchestration/model-selector";
import { instrumentQuery } from "@/lib/observability/instrument-query";

delete process.env.CLAUDECODE;
import type { SearchHit } from "./miner";

// ── Types ──────────────────────────────────────────────────────────────────

export type EvidenceClassification =
  | "confirmation"
  | "contradiction"
  | "discovery"
  | "evolution"
  | "failure"
  | "tool_evaluation";

export interface EvidenceItem {
  sessionId: string;
  sessionFile: string;
  timestamp: string;
  classification: EvidenceClassification;
  relevanceScore: number;
  contextExcerpt: string;
  projectName: string;
  messageIndex: number;
}

// ── Classification logic ───────────────────────────────────────────────────

const VALID_CLASSIFICATIONS = new Set<EvidenceClassification>([
  "confirmation",
  "contradiction",
  "discovery",
  "evolution",
  "failure",
  "tool_evaluation",
]);

function isValidClassification(v: string): v is EvidenceClassification {
  return VALID_CLASSIFICATIONS.has(v as EvidenceClassification);
}

/**
 * Classifies a batch of search hits relative to `topic` using a single
 * Anthropic API call. Returns one EvidenceItem per hit, in the same order.
 *
 * Falls back to a heuristic classification if the API call fails or returns
 * malformed JSON — ensuring every hit always produces an EvidenceItem.
 */
export async function classifyEvidence(
  hits: SearchHit[],
  topic: string
): Promise<EvidenceItem[]> {
  if (hits.length === 0) return [];

  // Build a compact representation of each hit for the prompt
  const hitsSummary = hits.map((hit, idx) => ({
    index: idx,
    excerpt: hit.contextExcerpt.slice(0, 500),
    role: hit.document.role,
    projectName: hit.document.projectName,
  }));

  const prompt = `You are an evidence classifier. Given a topic and a list of excerpts from Claude coding session transcripts, classify each excerpt.

TOPIC: "${topic}"

CLASSIFICATION TYPES:
- confirmation: The excerpt confirms or demonstrates the topic working as expected
- contradiction: The excerpt contradicts, disproves, or raises issues with the topic
- discovery: The excerpt reveals something new or unexpected about the topic
- evolution: The excerpt shows the topic changing or being refined over time
- failure: The excerpt documents a failure, bug, or error related to the topic
- tool_evaluation: The excerpt evaluates a tool, library, or approach related to the topic

EXCERPTS:
${JSON.stringify(hitsSummary, null, 2)}

Respond with a JSON array (one object per excerpt, same order) where each object has:
- "index": number (same as input index)
- "classification": one of the classification type strings above
- "relevanceScore": number between 0.0 and 1.0 (how relevant is this excerpt to the topic)

Reply with ONLY the JSON array, no other text.`;

  let classifications: Array<{
    index: number;
    classification: string;
    relevanceScore: number;
  }> = [];

  try {
    const model = getHaikuModel();
    let text = "";
    await instrumentQuery("evidence-classifier", "system", async () => {
      for await (const message of query({
        prompt,
        options: { model, maxTurns: 1 },
      })) {
        if ("result" in message) {
          text = message.result ?? "";
        }
      }
    });

    // Extract JSON array from response (strip any markdown fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        classifications = parsed;
      }
    }
  } catch (err) {
    console.error("[evidence-classifier] API call failed:", err);
    // Fall through to heuristic fallback
  }

  // Build a lookup from index → classification result
  const classMap = new Map<
    number,
    { classification: EvidenceClassification; relevanceScore: number }
  >();
  for (const c of classifications) {
    const cls = isValidClassification(c.classification)
      ? c.classification
      : heuristicClassification(hits[c.index]?.contextExcerpt ?? "");
    const score =
      typeof c.relevanceScore === "number"
        ? Math.max(0, Math.min(1, c.relevanceScore))
        : heuristicScore(hits[c.index]);
    classMap.set(c.index, { classification: cls, relevanceScore: score });
  }

  // Map each hit to an EvidenceItem, using fallback for any missing entries
  return hits.map((hit, idx) => {
    const classified = classMap.get(idx) ?? {
      classification: heuristicClassification(hit.contextExcerpt),
      relevanceScore: heuristicScore(hit),
    };

    return {
      sessionId: hit.document.sessionId,
      sessionFile: hit.document.filePath,
      timestamp: hit.document.timestamp,
      classification: classified.classification,
      relevanceScore: classified.relevanceScore,
      contextExcerpt: hit.contextExcerpt,
      projectName: hit.document.projectName,
      messageIndex: hit.document.messageIndex,
    };
  });
}

// ── SessionEvidence adapter ───────────────────────────────────────────────

import type { SessionEvidence } from "@/lib/ingestion/source-assembler";

/**
 * Converts EvidenceItem[] (from classifyEvidence) to SessionEvidence[]
 * (expected by assembleSourceMaterial).
 */
export function toSessionEvidence(items: EvidenceItem[]): SessionEvidence[] {
  return items.map((item) => ({
    sessionId: item.sessionId,
    title: `${item.classification}: ${item.projectName}`,
    summary: item.contextExcerpt.slice(0, 300),
    relevantExcerpts: [item.contextExcerpt],
    topics: [item.projectName, item.classification].filter(Boolean),
  }));
}

// ── Heuristic fallbacks ────────────────────────────────────────────────────

const FAILURE_PATTERNS =
  /\b(error|fail|exception|crash|bug|broken|undefined|cannot|cannot|refused)\b/i;
const TOOL_PATTERNS =
  /\b(npm|bun|yarn|brew|curl|wget|docker|git|install|package)\b/i;
const CONTRADICTION_PATTERNS = /\b(but|however|instead|wrong|incorrect|not)\b/i;
const DISCOVERY_PATTERNS = /\b(discovered|found|realized|turns out|interesting)\b/i;
const EVOLUTION_PATTERNS = /\b(refactor|changed|updated|migrated|rewrote|replaced)\b/i;

function heuristicClassification(excerpt: string): EvidenceClassification {
  if (FAILURE_PATTERNS.test(excerpt)) return "failure";
  if (TOOL_PATTERNS.test(excerpt)) return "tool_evaluation";
  if (CONTRADICTION_PATTERNS.test(excerpt)) return "contradiction";
  if (DISCOVERY_PATTERNS.test(excerpt)) return "discovery";
  if (EVOLUTION_PATTERNS.test(excerpt)) return "evolution";
  return "confirmation";
}

function heuristicScore(hit: SearchHit): number {
  // Normalize MiniSearch score to 0-1 range (scores are typically 0-20+)
  return Math.min(1, hit.score / 15);
}
