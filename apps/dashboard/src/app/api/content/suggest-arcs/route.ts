/**
 * POST /api/content/suggest-arcs
 *
 * Suggests narrative arc options tailored to a given topic.
 * Uses Claude Haiku for fast, lightweight arc generation.
 *
 * Body: { topic: string, sourceSummary?: string }
 * Returns: { arcs: Array<{ id: string, name: string, description: string, icon: string }> }
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getHaikuModel } from "@/lib/ai/orchestration/model-selector";

delete process.env.CLAUDECODE;

export const dynamic = "force-dynamic";

const suggestArcsSchema = z.object({
  topic: z.string().min(1, "topic is required").max(500),
  sourceSummary: z.string().max(2000).optional(),
});

// ── Arc definitions ─────────────────────────────────────────────────────────

interface ArcOption {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const ARC_TEMPLATES: readonly ArcOption[] = [
  {
    id: "journey",
    name: "Journey",
    description: "I started with X, tried Y, discovered Z",
    icon: "\u{1F5FA}\uFE0F", // world map emoji
  },
  {
    id: "thesis_evidence",
    name: "Thesis & Evidence",
    description: "Here's my claim, and here's the proof",
    icon: "\u{1F3AF}", // bullseye emoji
  },
  {
    id: "comparison",
    name: "Comparison",
    description: "Approach A vs Approach B \u2014 real data",
    icon: "\u2696\uFE0F", // scales emoji
  },
  {
    id: "evolution",
    name: "Evolution",
    description: "How my understanding changed over time",
    icon: "\u{1F504}", // arrows emoji
  },
] as const;

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { topic, sourceSummary } = parseBody(suggestArcsSchema, rawBody);

    const arcs = await suggestArcsForTopic(topic, sourceSummary);

    return new Response(JSON.stringify({ arcs }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })(req);
}

// ── Arc suggestion logic ────────────────────────────────────────────────────

async function suggestArcsForTopic(
  topic: string,
  sourceSummary?: string
): Promise<ArcOption[]> {
  const model = getHaikuModel();

  const contextLine = sourceSummary
    ? `\nSOURCE CONTEXT: ${sourceSummary.slice(0, 1000)}`
    : "";

  const prompt = `Given this blog topic, rank the following 4 narrative arc options from best to worst fit. For each, write a one-sentence description tailored to this specific topic (not generic).

TOPIC: "${topic}"${contextLine}

ARC OPTIONS:
1. journey (chronological account of solving a problem)
2. thesis_evidence (make a claim, then prove it with evidence)
3. comparison (compare approaches with real data)
4. evolution (show how understanding changed over time)

Respond with ONLY a JSON array of objects, ordered by best fit first. Each object:
- "id": one of "journey", "thesis_evidence", "comparison", "evolution"
- "description": one sentence tailored to this topic (max 120 chars)

Example: [{"id":"journey","description":"Follow the debugging path from initial crash to root cause fix"}]

Reply with ONLY the JSON array, no other text.`;

  try {
    let text = "";
    for await (const message of query({
      prompt,
      options: { model, maxTurns: 1 },
    })) {
      if ("result" in message) {
        text = message.result ?? "";
      }
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return buildArcsFromResponse(parsed);
      }
    }
  } catch (err) {
    console.error("[suggest-arcs] API call failed:", err);
    // Fall through to default arcs
  }

  // Fallback: return all arcs with default descriptions
  return [...ARC_TEMPLATES];
}

function buildArcsFromResponse(
  items: Array<{ id: string; description?: string }>
): ArcOption[] {
  const templateMap = new Map(ARC_TEMPLATES.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const result: ArcOption[] = [];

  for (const item of items) {
    const template = templateMap.get(item.id);
    if (!template || seen.has(item.id)) continue;

    seen.add(item.id);
    result.push({
      ...template,
      description:
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim().slice(0, 150)
          : template.description,
    });
  }

  // Add any templates not returned by the model
  for (const template of ARC_TEMPLATES) {
    if (!seen.has(template.id)) {
      result.push(template);
    }
  }

  return result;
}
