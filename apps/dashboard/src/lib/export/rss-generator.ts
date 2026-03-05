import type { ExportablePost } from "./markdown-export";
import { slugifyTitle } from "./markdown-export";

export interface RssFeedOptions {
  /** Base URL of the site, e.g. "https://example.com" */
  baseUrl: string;
  /** Title of the RSS feed / site */
  title: string;
  /** Description of the RSS feed / site */
  description?: string;
  /** Language code, e.g. "en-us" */
  language?: string;
  /** Maximum number of items to include (most recent first) */
  maxItems?: number;
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

/** Escape XML special characters in a string */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Format a Date to RFC 822 format required by RSS 2.0 */
function formatRfc822(date: Date | null): string {
  const d = date ?? new Date();
  return d.toUTCString();
}

/** Build the post URL for an RSS item */
function buildPostUrl(post: ExportablePost, baseUrl: string): string {
  const slug = slugifyTitle(post.title) || post.id.slice(0, 8);
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}/posts/${slug}/`;
}

/** Build a plain-text description excerpt from markdown (first ~200 chars) */
function buildDescription(markdown: string): string {
  // Strip markdown syntax characters for a plain-text summary
  const plain = markdown
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+>]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();

  return plain.length > 200 ? `${plain.slice(0, 200)}…` : plain;
}

/** Build an RSS <item> element from a post */
export function buildRssItem(post: ExportablePost, baseUrl: string): RssItem {
  const link = buildPostUrl(post, baseUrl);
  return {
    title: post.title,
    link,
    description: buildDescription(post.markdown),
    pubDate: formatRfc822(post.createdAt),
    guid: link,
  };
}

/** Render a single <item> block */
function renderRssItem(item: RssItem): string {
  return [
    "    <item>",
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.link)}</link>`,
    `      <description>${escapeXml(item.description)}</description>`,
    `      <pubDate>${item.pubDate}</pubDate>`,
    `      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>`,
    "    </item>",
  ].join("\n");
}

/** Generate a complete RSS 2.0 feed XML string for the given posts */
export function generateRssFeed(
  posts: ExportablePost[],
  options: RssFeedOptions
): string {
  const {
    baseUrl,
    title,
    description = "",
    language = "en-us",
    maxItems,
  } = options;

  const normalizedBase = baseUrl.replace(/\/$/, "");

  // Sort posts by date descending (most recent first)
  const sorted = [...posts].sort((a, b) => {
    const dateA = a.createdAt?.getTime() ?? 0;
    const dateB = b.createdAt?.getTime() ?? 0;
    return dateB - dateA;
  });

  const limited = maxItems !== undefined ? sorted.slice(0, maxItems) : sorted;

  const lastBuildDate = formatRfc822(limited[0]?.createdAt ?? new Date());

  const items = limited
    .map((post) => buildRssItem(post, normalizedBase))
    .map(renderRssItem)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(normalizedBase)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <language>${language}</language>`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(`${normalizedBase}/feed.xml`)}" rel="self" type="application/rss+xml"/>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
