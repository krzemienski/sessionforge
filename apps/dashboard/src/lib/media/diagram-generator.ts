import { query } from "@anthropic-ai/claude-agent-sdk";
import { getHaikuModel } from "@/lib/ai/orchestration/model-selector";

delete process.env.CLAUDECODE;

// ── Types ──────────────────────────────────────────────────────────────────

export interface GeneratedDiagram {
  mermaidMarkup: string;
  diagramType: string; // flowchart, sequence, mindmap, etc.
  altText: string;
  caption: string;
  suggestedSection: string; // which section of the post this diagram fits
}

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a diagram design expert. Given blog post content, identify concepts that would benefit from visual diagrams and generate Mermaid.js markup for them.

Rules:
- Generate 1-3 diagrams that add genuine visual value
- Use appropriate diagram types: flowchart, sequence, mindmap, timeline, pie, classDiagram, etc.
- Keep diagrams simple and readable (under 20 nodes)
- Each diagram should illustrate a DIFFERENT concept from the post
- Use clear, concise labels
- Respond with ONLY a JSON array, no markdown fences

Each object:
{
  "mermaidMarkup": "graph TD\\n  A[Start] --> B[End]",
  "diagramType": "flowchart",
  "altText": "Flow diagram showing the process",
  "caption": "Figure: The main process flow",
  "suggestedSection": "The section heading where this fits best"
}`;

// ── Generator ──────────────────────────────────────────────────────────────

export async function generateDiagrams(
  postMarkdown: string
): Promise<GeneratedDiagram[]> {
  const model = getHaikuModel();
  const truncatedContent = postMarkdown.slice(0, 6000);

  const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this blog post and generate Mermaid diagrams for concepts that would benefit from visualization:\n\n${truncatedContent}`;

  let text = "";
  for await (const message of query({
    prompt,
    options: { model, maxTurns: 1 },
  })) {
    if ("result" in message) {
      text = message.result ?? "";
    }
  }

  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is GeneratedDiagram =>
          item !== null &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).mermaidMarkup === "string" &&
          typeof (item as Record<string, unknown>).diagramType === "string"
      )
      .map((item) => ({
        mermaidMarkup: item.mermaidMarkup,
        diagramType: item.diagramType,
        altText:
          typeof item.altText === "string" ? item.altText : "Diagram",
        caption:
          typeof item.caption === "string" ? item.caption : "",
        suggestedSection:
          typeof item.suggestedSection === "string"
            ? item.suggestedSection
            : "",
      }))
      .slice(0, 3);
  } catch {
    return [];
  }
}
