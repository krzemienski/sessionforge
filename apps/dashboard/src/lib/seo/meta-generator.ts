/**
 * AI-powered meta suggestions generator.
 * Uses the Agent SDK to analyse post content and produce optimised
 * meta title, meta description, keyword suggestions, and an OG image prompt
 * for both traditional and generative search engine visibility.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { getSonnetModel } from "../ai/orchestration/model-selector";

delete process.env.CLAUDECODE;

/** Structured meta suggestions produced by the AI generator. */
export interface MetaSuggestions {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogImagePrompt: string;
}

/** Input parameters for the meta suggestions generator. */
export interface MetaGeneratorInput {
  content: string;
  title?: string;
  targetAudience?: string;
  contentDomain?: string;
}

const SYSTEM_PROMPT = `You are an expert SEO strategist specialising in technical developer content.
Your task is to analyse a blog post and generate optimised metadata that maximises visibility
in both traditional search engines (Google) and generative AI engines (Perplexity, ChatGPT Search,
Google AI Overviews).

Respond with ONLY a valid JSON object matching this exact schema — no markdown fences, no preamble:
{
  "metaTitle": "string (50-60 characters, include primary keyword near the front)",
  "metaDescription": "string (150-160 characters, compelling, includes primary keyword and a call to action)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "ogImagePrompt": "string (detailed image generation prompt for a professional OG image)"
}

Rules:
- metaTitle: 50–60 characters, lead with the primary keyword, make it click-worthy.
- metaDescription: 150–160 characters, include the primary keyword, end with a subtle CTA.
- keywords: exactly 3–5 terms or short phrases ordered by relevance (most relevant first).
  Prefer specific long-tail phrases over generic single words.
- ogImagePrompt: write as a detailed image generation prompt — specify style, colours, and
  key visual elements that represent the post topic. Aim for a professional, tech-oriented aesthetic.`;

function buildUserMessage(input: MetaGeneratorInput): string {
  const lines: string[] = [];

  if (input.title) {
    lines.push(`Post title: ${input.title}`);
  }
  if (input.targetAudience) {
    lines.push(`Target audience: ${input.targetAudience}`);
  }
  if (input.contentDomain) {
    lines.push(`Content domain: ${input.contentDomain}`);
  }

  lines.push("", "Post content:", input.content.trim());

  return lines.join("\n");
}

function parseMetaSuggestions(raw: string): MetaSuggestions {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error(`Meta generator returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Meta generator response is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.metaTitle !== "string" || obj.metaTitle.trim().length === 0) {
    throw new Error("Meta generator response is missing a valid metaTitle");
  }
  if (typeof obj.metaDescription !== "string" || obj.metaDescription.trim().length === 0) {
    throw new Error("Meta generator response is missing a valid metaDescription");
  }
  if (!Array.isArray(obj.keywords) || obj.keywords.length === 0) {
    throw new Error("Meta generator response is missing a valid keywords array");
  }
  if (typeof obj.ogImagePrompt !== "string" || obj.ogImagePrompt.trim().length === 0) {
    throw new Error("Meta generator response is missing a valid ogImagePrompt");
  }

  return {
    metaTitle: obj.metaTitle.trim(),
    metaDescription: obj.metaDescription.trim(),
    keywords: (obj.keywords as unknown[])
      .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      .map((k) => k.trim()),
    ogImagePrompt: obj.ogImagePrompt.trim(),
  };
}

/**
 * Generates AI-powered SEO meta suggestions for a piece of content.
 * Uses the Agent SDK query() function which inherits auth from the CLI session.
 */
export async function generateMetaSuggestions(
  input: MetaGeneratorInput
): Promise<MetaSuggestions> {
  if (!input.content || input.content.trim().length === 0) {
    throw new Error("Content is required to generate meta suggestions");
  }

  const model = getSonnetModel();
  const userMessage = buildUserMessage(input);

  let responseText: string | null = null;
  for await (const message of query({
    prompt: `${SYSTEM_PROMPT}\n\n${userMessage}`,
    options: {
      model,
      maxTurns: 1,
    },
  })) {
    if ("result" in message) {
      responseText = message.result;
    }
  }

  if (!responseText) {
    throw new Error("Meta generator received no text content from the model");
  }

  return parseMetaSuggestions(responseText);
}
