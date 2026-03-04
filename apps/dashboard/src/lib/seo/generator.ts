/**
 * SEO metadata generator using the Agent SDK.
 * Analyzes blog post content and generates optimized metadata (no tools needed).
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { getHaikuModel } from "@/lib/ai/orchestration/model-selector";

delete process.env.CLAUDECODE;

import type { SeoMetadata } from "./scoring";

interface InsightData {
  title: string;
  description: string;
  category: string;
}

function buildPrompt(
  markdown: string,
  title: string,
  insightData?: InsightData,
): string {
  const insightSection = insightData
    ? `\nInsight context:
- Title: ${insightData.title}
- Description: ${insightData.description}
- Category: ${insightData.category}`
    : "";

  const contentPreview = markdown.slice(0, 3000);

  return `You are an SEO expert. Analyze this blog post and generate optimized SEO metadata.

Post title: ${title}${insightSection}

Post content (first 3000 chars):
${contentPreview}

Respond ONLY with a valid JSON object — no markdown, no explanation, no code fences. The JSON must have these exact fields:
{
  "metaTitle": "string, max 60 chars, compelling and keyword-rich",
  "metaDescription": "string, max 155 chars, descriptive and includes focus keyword",
  "focusKeyword": "string, single most important keyword or phrase",
  "additionalKeywords": ["array", "of", "3", "to", "5", "keywords"],
  "ogTitle": "string, optimized for social sharing, can be slightly longer than metaTitle",
  "ogDescription": "string, engaging social sharing description",
  "twitterTitle": "string, punchy title for Twitter/X",
  "twitterDescription": "string, concise Twitter/X description",
  "twitterCard": "summary_large_image",
  "schemaOrg": {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "string",
    "description": "string",
    "keywords": "string, comma-separated keywords",
    "articleSection": "string, category or topic"
  }
}`;
}

export async function generateSeoMetadata(
  markdown: string,
  title: string,
  insightData?: InsightData,
): Promise<SeoMetadata> {
  const model = getHaikuModel();
  const prompt = buildPrompt(markdown, title, insightData);

  // Use Agent SDK query() with no tools for pure text generation
  let responseText: string | null = null;
  for await (const message of query({
    prompt,
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
    throw new Error("No text response from SEO metadata generation");
  }

  const rawText = responseText.trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    // Attempt to extract JSON from response if surrounded by extra text
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Failed to parse SEO metadata JSON from response");
    }
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  }

  // Extract and validate string fields
  const getString = (key: string): string | null => {
    const val = parsed[key];
    return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
  };

  const getStringArray = (key: string): string[] | null => {
    const val = parsed[key];
    if (!Array.isArray(val)) return null;
    const filtered = val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return filtered.length > 0 ? filtered : null;
  };

  const getObject = (key: string): Record<string, unknown> | null => {
    const val = parsed[key];
    return val !== null && typeof val === "object" && !Array.isArray(val)
      ? (val as Record<string, unknown>)
      : null;
  };

  // Build result with enforced character limits
  let metaTitle = getString("metaTitle");
  if (metaTitle && metaTitle.length > 60) {
    metaTitle = metaTitle.slice(0, 60);
  }

  let metaDescription = getString("metaDescription");
  if (metaDescription && metaDescription.length > 155) {
    metaDescription = metaDescription.slice(0, 155);
  }

  const result: SeoMetadata = {
    metaTitle,
    metaDescription,
    focusKeyword: getString("focusKeyword"),
    additionalKeywords: getStringArray("additionalKeywords"),
    ogTitle: getString("ogTitle"),
    ogDescription: getString("ogDescription"),
    twitterTitle: getString("twitterTitle"),
    twitterDescription: getString("twitterDescription"),
    twitterCard: "summary_large_image",
    schemaOrg: getObject("schemaOrg"),
    generatedAt: new Date().toISOString(),
  };

  return result;
}
