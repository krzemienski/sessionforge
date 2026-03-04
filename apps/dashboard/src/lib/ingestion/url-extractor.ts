/**
 * URL content extractor.
 * Fetches a URL, parses the HTML with cheerio, and extracts clean article
 * content. Falls back to a raw HTML summary on failure.
 */

import * as cheerio from "cheerio";

export interface ParsedURL {
  url: string;
  title: string;
  author: string | null;
  publishDate: string | null;
  mainContent: string;
  excerpt: string;
  images: string[];
  codeBlocks: string[];
}

// Local DOM node shapes — avoids direct dependency on domhandler package
interface DomTextNode { type: "text"; data?: string }
interface DomElementNode { type: string; tagName?: string; children?: DomNode[] }
type DomNode = DomTextNode | DomElementNode;

/** Convert a cheerio-parsed HTML subtree to plain markdown-ish text. */
function htmlToMarkdown($: cheerio.CheerioAPI, el: DomElementNode): string {
  const lines: string[] = [];

  const processNode = (node: DomNode): string => {
    if (node.type === "text") {
      return (node as DomTextNode).data ?? "";
    }
    if (node.type !== "tag") return "";

    const elem = node as DomElementNode;
    const tag = elem.tagName?.toLowerCase() ?? "";
    const children = elem.children ?? [];
    const childText = children.map(processNode).join("");

    switch (tag) {
      case "h1": return `\n# ${childText.trim()}\n`;
      case "h2": return `\n## ${childText.trim()}\n`;
      case "h3": return `\n### ${childText.trim()}\n`;
      case "h4": return `\n#### ${childText.trim()}\n`;
      case "h5": return `\n##### ${childText.trim()}\n`;
      case "h6": return `\n###### ${childText.trim()}\n`;
      case "p":  return `\n${childText.trim()}\n`;
      case "br": return "\n";
      case "strong":
      case "b":  return `**${childText}**`;
      case "em":
      case "i":  return `_${childText}_`;
      case "code": return `\`${childText}\``;
      case "pre": return `\n\`\`\`\n${childText}\n\`\`\`\n`;
      case "blockquote": return `\n> ${childText.trim()}\n`;
      case "a":  return childText;
      case "li": return `\n- ${childText.trim()}`;
      case "ul":
      case "ol": return `\n${childText}\n`;
      case "hr": return "\n---\n";
      case "img": return "";
      case "script":
      case "style":
      case "nav":
      case "footer":
      case "aside": return "";
      default:   return childText;
    }
  };

  lines.push(processNode(el));
  return lines.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** Extract the main article body from a cheerio document. */
function extractMainContent($: cheerio.CheerioAPI): { content: string; codeBlocks: string[] } {

  // Remove noise elements first
  $("script, style, nav, footer, aside, header, .sidebar, .ads, .advertisement, [role='navigation'], [role='banner']").remove();

  const codeBlocks: string[] = [];

  // Collect all code blocks before stripping
  $("pre code, pre").each((_, el) => {
    const code = $(el).text().trim();
    if (code.length > 10) {
      codeBlocks.push(code);
    }
  });

  // Try common article containers in preference order
  const candidates = [
    "article",
    "main",
    "[role='main']",
    ".post-content",
    ".article-content",
    ".entry-content",
    ".content",
    "#content",
    ".prose",
    ".markdown-body",
    ".post-body",
    "div.content",
  ];

  for (const selector of candidates) {
    const el = $(selector).first();
    if (el.length && el.text().trim().length > 200) {
      return { content: htmlToMarkdown($, el[0] as unknown as DomElementNode), codeBlocks };
    }
  }

  // Fallback: use body
  const body = $("body").first();
  if (body.length) {
    return { content: htmlToMarkdown($, body[0] as unknown as DomElementNode), codeBlocks };
  }

  return { content: $.text(), codeBlocks };
}

/** Extract images from the page. */
function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  $("img[src]").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (!src || src.startsWith("data:")) return;

    try {
      const resolved = new URL(src, baseUrl).href;
      if (!seen.has(resolved)) {
        seen.add(resolved);
        images.push(resolved);
      }
    } catch {
      // Ignore unresolvable URLs
    }
  });

  return images.slice(0, 20); // Cap at 20 images
}

/** Extract metadata from meta tags. */
function extractMeta($: cheerio.CheerioAPI): { title: string; author: string | null; publishDate: string | null; excerpt: string } {
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    "Untitled";

  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('[rel="author"]').first().text().trim() ||
    $(".author").first().text().trim() ||
    null;

  const publishDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    null;

  const excerpt =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    "";

  return {
    title: title.slice(0, 500),
    author: author ? author.trim().slice(0, 200) : null,
    publishDate: publishDate ?? null,
    excerpt: excerpt.slice(0, 500),
  };
}

/** Fetch and parse a URL, returning structured content. */
export async function extractURL(url: string): Promise<ParsedURL> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let html: string;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SessionForge/1.0; +https://sessionforge.dev/bot)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }

      html = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    const $ = cheerio.load(html);
    const meta = extractMeta($);
    const { content, codeBlocks } = extractMainContent($);
    const images = extractImages($, url);

    return {
      url,
      title: meta.title,
      author: meta.author,
      publishDate: meta.publishDate,
      mainContent: content.slice(0, 50_000), // Cap content at 50k chars
      excerpt: meta.excerpt || content.slice(0, 300).replace(/\n/g, " ").trim(),
      images,
      codeBlocks: codeBlocks.slice(0, 30),
    };
  } catch (error) {
    // Graceful fallback: return minimal info with error note
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      url,
      title: url,
      author: null,
      publishDate: null,
      mainContent: `[Content extraction failed: ${errorMsg}]`,
      excerpt: `Failed to extract content from ${url}`,
      images: [],
      codeBlocks: [],
    };
  }
}
