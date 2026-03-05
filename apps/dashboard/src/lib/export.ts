/**
 * Export utilities for content formatting and download.
 * All functions are pure/side-effect-free except downloadMarkdownFile and downloadHtmlFile.
 */

import {
  generateStructuredData,
  wrapInScriptTag,
} from "./seo/structured-data-generator";
import type { StructuredDataInput } from "./seo/structured-data-generator";

/** Twitter's character limit per tweet */
const TWITTER_CHAR_LIMIT = 280;

/** LinkedIn's character limit per post */
const LINKEDIN_CHAR_LIMIT = 3000;

/**
 * Formats a markdown document as a Twitter thread.
 * Splits on --- separators and prefixes each tweet with "1/N", "2/N", etc.
 */
export function formatTwitterThread(markdown: string): string {
  const tweets = markdown
    .split(/\n---\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tweets.length === 0) return markdown.trim();

  const total = tweets.length;

  return tweets
    .map((tweet, i) => {
      const prefix = total > 1 ? `${i + 1}/${total}\n\n` : "";
      // Strip markdown syntax for clean clipboard text
      const cleaned = stripMarkdownSyntax(tweet);
      return `${prefix}${cleaned}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Formats a markdown document as a LinkedIn post.
 * Strips markdown syntax, preserves paragraph spacing, and ensures clean line breaks.
 */
export function formatLinkedIn(markdown: string): string {
  let text = markdown.trim();

  // Convert markdown headings to uppercase text with spacing
  text = text.replace(/^#{1,6}\s+(.+)$/gm, (_, heading: string) =>
    heading.toUpperCase()
  );

  // Convert bold/italic markers to plain text
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  text = text.replace(/\*\*(.+?)\*\*/g, "$1");
  text = text.replace(/__(.+?)__/g, "$1");
  text = text.replace(/\*(.+?)\*/g, "$1");
  text = text.replace(/_(.+?)_/g, "$1");

  // Convert inline code to plain text
  text = text.replace(/`([^`]+)`/g, "$1");

  // Convert fenced code blocks to indented text
  text = text.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code: string) =>
    code
      .trim()
      .split("\n")
      .map((line: string) => `    ${line}`)
      .join("\n")
  );

  // Convert links to just their text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Convert list items to bullet points
  text = text.replace(/^[-*+]\s+/gm, "• ");
  text = text.replace(/^\d+\.\s+/gm, "• ");

  // Ensure double line breaks between paragraphs for LinkedIn readability
  text = text.replace(/\n{3,}/g, "\n\n");

  // Remove --- separators
  text = text.replace(/^---$/gm, "").replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Converts markdown to basic HTML.
 * Handles headings, bold, italic, inline code, code blocks, links, and paragraphs.
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown.trim();

  // Fenced code blocks (process before other substitutions)
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_: string, lang: string | undefined, code: string) => {
      const langAttr = lang ? ` class="language-${lang}"` : "";
      return `<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`;
    }
  );

  // Split into blocks (paragraphs separated by blank lines)
  const blocks = html.split(/\n\n+/);

  const processedBlocks = blocks.map((block) => {
    // Skip pre blocks — already processed
    if (block.startsWith("<pre>")) return block;

    // Headings
    const headingMatch = block.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = inlineMarkdown(headingMatch[2]);
      return `<h${level}>${content}</h${level}>`;
    }

    // Unordered lists
    if (/^[-*+]\s+/m.test(block)) {
      const items = block
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const itemMatch = line.match(/^[-*+]\s+(.+)$/);
          return itemMatch ? `<li>${inlineMarkdown(itemMatch[1])}</li>` : "";
        })
        .filter(Boolean)
        .join("");
      return `<ul>${items}</ul>`;
    }

    // Ordered lists
    if (/^\d+\.\s+/m.test(block)) {
      const items = block
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const itemMatch = line.match(/^\d+\.\s+(.+)$/);
          return itemMatch ? `<li>${inlineMarkdown(itemMatch[1])}</li>` : "";
        })
        .filter(Boolean)
        .join("");
      return `<ol>${items}</ol>`;
    }

    // Horizontal rule
    if (/^---$/.test(block.trim())) return "<hr />";

    // Paragraph — replace single newlines with <br> within the paragraph
    const lines = block.split("\n").map(inlineMarkdown).join("<br />");
    return `<p>${lines}</p>`;
  });

  return processedBlocks.join("\n");
}

/**
 * Triggers a browser download of the given markdown content as a .md file.
 * Filename format: slugified-title-YYYY-MM-DD.md
 */
export function downloadMarkdownFile(title: string, markdown: string): void {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${slug || "untitled"}-${date}.md`;

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Options for generating a full HTML document export. */
export interface HtmlExportOptions {
  /** Short description used in <meta name="description"> and structured data. */
  description?: string;
  /** ISO 8601 date string for datePublished in structured data. Defaults to now. */
  datePublished?: string;
  /** ISO 8601 date string for dateModified. Defaults to datePublished. */
  dateModified?: string;
  /** Canonical URL for <link rel="canonical"> and structured data. */
  url?: string;
  /** OG image URL embedded in structured data. */
  imageUrl?: string;
  /** Author metadata for structured data. Defaults to { name: "Unknown" }. */
  author?: { name: string; url?: string };
  /** Publisher metadata for structured data. Defaults to { name: "SessionForge" }. */
  publisher?: { name: string; url?: string; logoUrl?: string };
  /** Keywords to embed in structured data. */
  keywords?: string[];
  /**
   * Pre-generated JSON-LD string to inject as-is into the <head>.
   * When provided, automatic structured data generation is skipped.
   */
  structuredData?: string;
}

/**
 * Generates a complete HTML document from a title and markdown content.
 * Injects a JSON-LD structured data script tag into <head> for SEO.
 * If options.structuredData is supplied it is used directly; otherwise
 * structured data is auto-generated via generateStructuredData().
 */
export function generateHtmlDocument(
  title: string,
  markdown: string,
  options: HtmlExportOptions = {}
): string {
  const bodyHtml = markdownToHtml(markdown);

  let jsonLdScriptTag: string;

  if (options.structuredData !== undefined && options.structuredData !== "") {
    jsonLdScriptTag = `<script type="application/ld+json">${options.structuredData}</script>`;
  } else {
    const input: StructuredDataInput = {
      title,
      content: markdown,
      description: options.description,
      datePublished: options.datePublished ?? new Date().toISOString(),
      dateModified: options.dateModified,
      url: options.url,
      imageUrl: options.imageUrl,
      author: options.author ?? { name: "Unknown" },
      publisher: options.publisher ?? { name: "SessionForge" },
      keywords: options.keywords,
    };
    const result = generateStructuredData(input);
    jsonLdScriptTag = wrapInScriptTag(result.jsonLd);
  }

  const escapedTitle = escapeHtml(title);
  const metaDescriptionTag = options.description
    ? `\n  <meta name="description" content="${escapeHtml(options.description)}" />`
    : "";
  const canonicalTag = options.url
    ? `\n  <link rel="canonical" href="${escapeHtml(options.url)}" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>${metaDescriptionTag}${canonicalTag}
  ${jsonLdScriptTag}
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Triggers a browser download of the post as a self-contained .html file.
 * Embeds JSON-LD structured data in <head> for SEO.
 * Filename format: slugified-title-YYYY-MM-DD.html
 */
export function downloadHtmlFile(
  title: string,
  markdown: string,
  options: HtmlExportOptions = {}
): void {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${slug || "untitled"}-${date}.html`;

  const html = generateHtmlDocument(title, markdown, options);

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Returns tweet count and the character length of the longest tweet
 * for a formatted Twitter thread (output of formatTwitterThread).
 */
export function getTwitterCharCount(markdown: string): {
  tweetCount: number;
  longestTweetChars: number;
} {
  const formatted = formatTwitterThread(markdown);
  const tweets = formatted.split("\n\n---\n\n").filter(Boolean);
  const tweetCount = tweets.length;
  const longestTweetChars = tweets.reduce(
    (max, tweet) => Math.max(max, tweet.length),
    0
  );
  return { tweetCount, longestTweetChars };
}

/**
 * Returns the character count for a LinkedIn post
 * (after LinkedIn formatting is applied).
 */
export function getLinkedInCharCount(markdown: string): number {
  return formatLinkedIn(markdown).length;
}

/** Twitter char limit constant for use in UI components */
export { TWITTER_CHAR_LIMIT, LINKEDIN_CHAR_LIMIT };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strips common markdown syntax from a string, returning plain text.
 * Used for Twitter thread formatting where markdown renders poorly.
 */
function stripMarkdownSyntax(text: string): string {
  let out = text;

  // Remove fenced code blocks, preserve content
  out = out.replace(/```[\w]*\n([\s\S]*?)```/g, "$1");

  // Remove inline code backticks
  out = out.replace(/`([^`]+)`/g, "$1");

  // Remove heading markers
  out = out.replace(/^#{1,6}\s+/gm, "");

  // Remove bold/italic
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  out = out.replace(/__(.+?)__/g, "$1");
  out = out.replace(/\*(.+?)\*/g, "$1");
  out = out.replace(/_(.+?)_/g, "$1");

  // Simplify links to display text
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Normalise list markers
  out = out.replace(/^[-*+]\s+/gm, "• ");
  out = out.replace(/^\d+\.\s+/gm, "• ");

  return out.trim();
}

/** Processes inline markdown (bold, italic, code, links) within a text fragment. */
function inlineMarkdown(text: string): string {
  let out = text;

  // Bold+italic
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/_(.+?)_/g, "<em>$1</em>");
  // Inline code
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return out;
}

/** Escapes HTML special characters to prevent XSS inside code blocks. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
