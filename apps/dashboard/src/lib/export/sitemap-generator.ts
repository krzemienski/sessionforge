import type { ExportablePost } from "./markdown-export";
import { slugifyTitle } from "./markdown-export";

export interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: string;
}

export interface SitemapOptions {
  /** Base URL of the site, e.g. "https://example.com" */
  baseUrl: string;
  /** Include the index page in the sitemap */
  includeIndex?: boolean;
}

/** Format a Date to YYYY-MM-DD for sitemap lastmod */
function formatLastmod(date: Date | null): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Build the URL entry for a single post */
export function buildPostSitemapUrl(
  post: ExportablePost,
  baseUrl: string
): SitemapUrl {
  const slug = slugifyTitle(post.title) || post.id.slice(0, 8);
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return {
    loc: `${normalizedBase}/posts/${slug}/`,
    lastmod: formatLastmod(post.updatedAt ?? post.createdAt),
    changefreq: "monthly",
    priority: "0.8",
  };
}

/** Build the URL entry for the index page */
export function buildIndexSitemapUrl(baseUrl: string): SitemapUrl {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return {
    loc: `${normalizedBase}/`,
    lastmod: formatLastmod(new Date()),
    changefreq: "weekly",
    priority: "1.0",
  };
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

/** Render a single <url> block */
function renderUrlEntry(entry: SitemapUrl): string {
  return [
    "  <url>",
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    `    <lastmod>${entry.lastmod}</lastmod>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    "  </url>",
  ].join("\n");
}

/** Generate a complete sitemap.xml string for the given posts */
export function generateSitemap(
  posts: ExportablePost[],
  options: SitemapOptions
): string {
  const { baseUrl, includeIndex = true } = options;

  const urls: SitemapUrl[] = [];

  if (includeIndex) {
    urls.push(buildIndexSitemapUrl(baseUrl));
  }

  for (const post of posts) {
    urls.push(buildPostSitemapUrl(post, baseUrl));
  }

  const urlEntries = urls.map(renderUrlEntry).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntries,
    "</urlset>",
    "",
  ].join("\n");
}
