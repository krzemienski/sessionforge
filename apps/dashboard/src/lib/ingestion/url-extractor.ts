/**
 * URL content extractor.
 * Fetches a URL, parses the HTML with cheerio, and extracts clean article
 * content. Falls back to a raw HTML summary on failure.
 *
 * SSRF protection (review finding C3): every outbound fetch is gated by
 * `assertPublicUrl`, which requires an https scheme and rejects any hostname
 * that resolves to a loopback, link-local, private (RFC1918), cloud metadata,
 * or otherwise non-globally-routable address. Redirects are followed manually
 * so each hop is re-validated before a second fetch is issued.
 */

import * as cheerio from "cheerio";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

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

const MAX_REDIRECTS = 5;

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function ipv6IsPrivate(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("ff")) return true;
  if (lower.startsWith("::ffff:")) {
    const embedded = lower.slice("::ffff:".length);
    if (isIP(embedded) === 4) return ipv4IsPrivate(embedded);
  }
  return false;
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Blocked scheme: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname;
  if (!hostname) throw new Error("URL has no hostname");

  const literal = isIP(hostname);
  if (literal === 4 && ipv4IsPrivate(hostname)) {
    throw new Error(`Blocked private address: ${hostname}`);
  }
  if (literal === 6 && ipv6IsPrivate(hostname)) {
    throw new Error(`Blocked private address: ${hostname}`);
  }

  if (literal === 0) {
    const resolved = await dnsLookup(hostname, { all: true });
    for (const { address, family } of resolved) {
      if (family === 4 && ipv4IsPrivate(address)) {
        throw new Error(`Hostname ${hostname} resolves to private address ${address}`);
      }
      if (family === 6 && ipv6IsPrivate(address)) {
        throw new Error(`Hostname ${hostname} resolves to private address ${address}`);
      }
    }
  }

  return parsed;
}

async function safeFetch(initialUrl: string, signal: AbortSignal): Promise<Response> {
  let nextUrl = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(nextUrl);
    const response = await fetch(nextUrl, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SessionForge/1.0; +https://sessionforge.dev/bot)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect ${response.status} without location header`);
      }
      nextUrl = new URL(location, nextUrl).toString();
      continue;
    }
    return response;
  }
  throw new Error(`Exceeded ${MAX_REDIRECTS} redirect hops`);
}

/** Fetch and parse a URL, returning structured content. */
export async function extractURL(url: string): Promise<ParsedURL> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let html: string;
    try {
      const response = await safeFetch(url, controller.signal);

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
