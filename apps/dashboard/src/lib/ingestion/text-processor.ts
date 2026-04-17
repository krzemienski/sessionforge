import { ensureCliAuth } from "@/lib/ai/ensure-cli-auth";
/**
 * Text processor.
 * Uses Claude to extract structured content brief from free-form user text.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// Allow Claude SDK subprocess spawning even when running inside a Claude Code session

ensureCliAuth();

export interface ContentBrief {
  thesis: string;
  keyPoints: string[];
  tone: string;
  audience: string;
  impliedQuestions: string[];
  referencedConcepts: string[];
}

const SYSTEM_PROMPT = `You are an expert content strategist. Analyze the user's text and extract a structured content brief.
Respond ONLY with a valid JSON object — no markdown fences, no extra text.`;

/** Extract a structured ContentBrief from free-form user text using Claude. */
export async function processUserText(text: string): Promise<ContentBrief> {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      thesis: "",
      keyPoints: [],
      tone: "neutral",
      audience: "general",
      impliedQuestions: [],
      referencedConcepts: [],
    };
  }

  const prompt = `Analyze this text and extract a structured content brief:

---
${trimmed.slice(0, 10_000)}
---

Return a JSON object with exactly these fields:
{
  "thesis": "The core argument or message in 1-2 sentences",
  "keyPoints": ["point1", "point2", ...],  // up to 8 key points
  "tone": "One of: technical, conversational, formal, educational, persuasive, narrative",
  "audience": "Description of the intended audience in 1 sentence",
  "impliedQuestions": ["question1", ...],  // up to 5 questions this content answers
  "referencedConcepts": ["concept1", ...]  // up to 10 technical concepts, tools, or ideas mentioned
}`;

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

  if (!responseText) {
    return buildFallbackBrief(trimmed);
  }

  try {
    const cleaned = responseText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<ContentBrief>;
    return {
      thesis: typeof parsed.thesis === "string" ? parsed.thesis : trimmed.slice(0, 200),
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 8) : [],
      tone: typeof parsed.tone === "string" ? parsed.tone : "neutral",
      audience: typeof parsed.audience === "string" ? parsed.audience : "general",
      impliedQuestions: Array.isArray(parsed.impliedQuestions) ? parsed.impliedQuestions.slice(0, 5) : [],
      referencedConcepts: Array.isArray(parsed.referencedConcepts) ? parsed.referencedConcepts.slice(0, 10) : [],
    };
  } catch {
    return buildFallbackBrief(trimmed);
  }
}

function buildFallbackBrief(text: string): ContentBrief {
  // Simple heuristic fallback when Claude call fails
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return {
    thesis: sentences[0]?.slice(0, 200) ?? text.slice(0, 200),
    keyPoints: sentences.slice(1, 5),
    tone: "neutral",
    audience: "general",
    impliedQuestions: [],
    referencedConcepts: [],
  };
}
