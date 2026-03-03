import type { SeoMetadata } from "./scoring";

/**
 * Escapes a YAML scalar value by wrapping in double quotes and escaping
 * internal double quotes and backslashes.
 */
function yamlString(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Serialises a string array as an inline YAML sequence, e.g.
 * ["keyword one", "keyword two"]
 */
function yamlStringArray(items: string[]): string {
  return `[${items.map(yamlString).join(", ")}]`;
}

/**
 * Generates a YAML frontmatter block from SEO metadata.
 *
 * Produces a valid `---\n...\n---` block with the following fields:
 * - title
 * - description  (from metaDescription)
 * - keywords     (focusKeyword prepended to additionalKeywords)
 * - og_title
 * - og_description
 * - twitter_title
 * - twitter_description
 * - twitter_card
 */
export function generateFrontmatter(title: string, seo: SeoMetadata): string {
  const lines: string[] = ["---"];

  lines.push(`title: ${yamlString(title)}`);

  const description = seo.metaDescription ?? "";
  lines.push(`description: ${yamlString(description)}`);

  const keywordParts: string[] = [];
  if (seo.focusKeyword) {
    keywordParts.push(seo.focusKeyword);
  }
  if (seo.additionalKeywords && seo.additionalKeywords.length > 0) {
    keywordParts.push(...seo.additionalKeywords);
  }
  lines.push(`keywords: ${yamlStringArray(keywordParts)}`);

  lines.push(`og_title: ${yamlString(seo.ogTitle ?? "")}`);
  lines.push(`og_description: ${yamlString(seo.ogDescription ?? "")}`);
  lines.push(`twitter_title: ${yamlString(seo.twitterTitle ?? "")}`);
  lines.push(`twitter_description: ${yamlString(seo.twitterDescription ?? "")}`);
  lines.push(`twitter_card: ${yamlString(seo.twitterCard ?? "summary_large_image")}`);

  lines.push("---");

  return lines.join("\n");
}

/**
 * Prepends SEO frontmatter to a markdown string, replacing any existing
 * frontmatter block (a `---` ... `---` block at the start of the document).
 */
export function withFrontmatter(
  markdown: string,
  title: string,
  seo: SeoMetadata
): string {
  const frontmatter = generateFrontmatter(title, seo);

  // Strip existing frontmatter: must start at position 0 with ---
  const stripped = markdown.replace(/^---\n[\s\S]*?\n---\n?/, "");

  return `${frontmatter}\n${stripped}`;
}
