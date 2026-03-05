/**
 * AI-powered meta suggestions generator.
 * Uses the Anthropic SDK to analyse post content and produce optimised
 * meta title, meta description, keyword suggestions, and an OG image prompt
 * for both traditional and generative search engine visibility.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getSonnetModel } from "../ai/orchestration/model-selector";

const client = new Anthropic();

/** Structured meta suggestions produced by the AI generator. */
export interface MetaSuggestions {
  /**
   * Optimised page title for search engines.
   * Should be 50–60 characters for best display in SERPs.
   */
  metaTitle: string;
  /**
   * Optimised meta description for search engines.
   * Should be 150–160 characters to avoid truncation.
   */
  metaDescription: string;
  /**
   * 3–5 primary keyword suggestions relevant to the content.
   * Listed in descending order of importance.
   */
  keywords: string[];
  /**
   * Descriptive prompt for generating an Open Graph image.
   * Written to be passed directly to an image generation model.
   */
  ogImagePrompt: string;
}

/** Input parameters for the meta suggestions generator. */
export interface MetaGeneratorInput {
  /** Markdown content of the post to analyse. */
  content: string;
  /**
   * Existing title of the post, used as context when crafting the meta title.
   * If omitted the AI derives a title from the content.
   */
  title?: string;
  /**
   * Description of the intended audience, used to tailor tone and vocabulary.
   * Example: "senior software engineers building distributed systems".
   */
  targetAudience?: string;
  /**
   * Primary domain or niche of the content.
   * Example: "DevOps", "machine learning", "TypeScript".
   */
  contentDomain?: string;
}

/**
 * System prompt instructing the model to act as an SEO expert and return
 * a strictly typed JSON object with meta field suggestions.
 */
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

/**
 * Builds the user message sent to Claude, incorporating all available context.
 *
 * @param input - Content, title, audience, and domain information.
 * @returns A formatted prompt string ready for the Anthropic messages API.
 */
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

/**
 * Parses and validates the raw JSON string returned by the model.
 * Throws if the response is not valid JSON or is missing required fields.
 *
 * @param raw - Raw text returned by the Anthropic API.
 * @returns Validated `MetaSuggestions` object.
 * @throws {Error} When the response cannot be parsed or fields are missing.
 */
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
 *
 * Sends the post content and optional context to Claude, which returns an
 * optimised meta title, meta description, keyword list, and OG image prompt.
 * The suggestions are returned as structured data — they are **not** saved;
 * the caller is responsible for persisting accepted suggestions.
 *
 * @param input - Content to analyse along with optional audience and domain context.
 * @returns Resolved `MetaSuggestions` object with all four meta fields populated.
 * @throws {Error} When the Anthropic API call fails or the response is malformed.
 */
export async function generateMetaSuggestions(
  input: MetaGeneratorInput
): Promise<MetaSuggestions> {
  if (!input.content || input.content.trim().length === 0) {
    throw new Error("Content is required to generate meta suggestions");
  }

  const model = getSonnetModel();
  const userMessage = buildUserMessage(input);

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");

  if (!textBlock) {
    throw new Error("Meta generator received no text content from the model");
  }

  return parseMetaSuggestions(textBlock.text);
}
