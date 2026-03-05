/**
 * End-to-end integration tests for the static site export pipeline.
 *
 * Exercises the full workflow: mock posts → buildStaticSiteZip → validate ZIP
 * contents for all three themes (minimal-portfolio, technical-blog, changelog).
 * Also validates sitemap.xml and RSS feed generation independently.
 *
 * These tests do NOT require a running server — they exercise the library
 * functions directly, simulating what the /api/collections/[id]/export route does.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import JSZip from "jszip";
import { buildStaticSiteZip } from "../static-site-builder";
import { generateSitemap, buildPostSitemapUrl, buildIndexSitemapUrl } from "../sitemap-generator";
import { generateRssFeed, buildRssItem } from "../rss-generator";
import type { ExportablePost } from "../markdown-export";
import type { ThemeId } from "../theme-manager";

// ---------------------------------------------------------------------------
// Mock posts — represent a real collection with 3+ posts
// ---------------------------------------------------------------------------

const MOCK_POSTS: ExportablePost[] = [
  {
    id: "post-001",
    title: "Getting Started with TypeScript",
    markdown: `# Getting Started with TypeScript

TypeScript adds static types to JavaScript, catching bugs at compile time.

## Installation

\`\`\`bash
npm install -g typescript
tsc --init
\`\`\`

## Basic Types

\`\`\`typescript
const greeting: string = "Hello, TypeScript!";
const count: number = 42;
const active: boolean = true;
\`\`\`

TypeScript's type system is **structural** — types are compatible if their shapes match.
`,
    contentType: "tutorial",
    status: "published",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-16T12:00:00Z"),
    platformFooterEnabled: false,
    durationMinutes: 45,
  },
  {
    id: "post-002",
    title: "React Hooks Deep Dive",
    markdown: `# React Hooks Deep Dive

Hooks let you use state and other React features without writing a class.

## useState

\`\`\`tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
\`\`\`

## useEffect

\`\`\`tsx
import { useEffect, useState } from "react";

function DataFetcher({ url }: { url: string }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(url).then(r => r.json()).then(setData);
  }, [url]);

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
\`\`\`
`,
    contentType: "article",
    status: "published",
    createdAt: new Date("2024-02-01T09:00:00Z"),
    updatedAt: new Date("2024-02-02T11:00:00Z"),
    platformFooterEnabled: true,
    durationMinutes: 60,
  },
  {
    id: "post-003",
    title: "Building REST APIs with Next.js",
    markdown: `# Building REST APIs with Next.js

Next.js App Router makes it easy to create API endpoints alongside your UI.

## Route Handlers

\`\`\`typescript
// app/api/hello/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello, World!" });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ received: body }, { status: 201 });
}
\`\`\`

## Authentication

Always validate sessions before returning sensitive data.
`,
    contentType: "tutorial",
    status: "published",
    createdAt: new Date("2024-03-10T14:00:00Z"),
    updatedAt: null,
    platformFooterEnabled: false,
    durationMinutes: 90,
  },
  {
    id: "post-004",
    title: "v2.0.0 Release Notes",
    markdown: `# v2.0.0 Release Notes

## Added
- New dark mode toggle with OS preference detection
- RSS feed generation for collections
- Sitemap.xml generation for SEO

## Changed
- Upgraded to React 19 with concurrent features
- Improved code block syntax highlighting

## Fixed
- Fixed link resolution for custom domain exports
- Resolved UTF-8 encoding issue in RSS feed
`,
    contentType: "changelog",
    status: "published",
    createdAt: new Date("2024-04-01T00:00:00Z"),
    updatedAt: new Date("2024-04-01T08:00:00Z"),
    platformFooterEnabled: false,
    durationMinutes: null,
  },
];

const THEMES: ThemeId[] = ["minimal-portfolio", "technical-blog", "changelog"];

// ---------------------------------------------------------------------------
// Helper: load and parse a ZIP buffer
// ---------------------------------------------------------------------------

async function loadZip(buffer: Buffer): Promise<JSZip> {
  const zip = new JSZip();
  await zip.loadAsync(buffer);
  return zip;
}

async function getZipFileContent(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async("string");
}

function getZipFilePaths(zip: JSZip): string[] {
  return Object.keys(zip.files).filter(f => !zip.files[f]!.dir);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Static Site Export - End-to-End Integration", () => {
  describe.each(THEMES)("Theme: %s", (themeId) => {
    let zip: JSZip;
    let filePaths: string[];
    let indexHtml: string;

    beforeAll(async () => {
      const buffer = await buildStaticSiteZip(MOCK_POSTS, {
        themeId,
        collectionName: "My Dev Blog",
        collectionDescription: "A collection of development articles",
        themeConfig: {
          siteTitle: "My Dev Blog",
          siteTagline: "Thoughts on software development",
          siteDescription: "A collection of development articles",
          authorName: "Jane Developer",
          baseUrl: "https://janedev.github.io",
          showRss: true,
          showAttribution: true,
        },
      });

      zip = await loadZip(buffer);
      filePaths = getZipFilePaths(zip);
      indexHtml = (await getZipFileContent(zip, "index.html")) ?? "";
    });

    it("generates a valid ZIP buffer", async () => {
      const buffer = await buildStaticSiteZip(MOCK_POSTS, { themeId });
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it("includes index.html", () => {
      expect(filePaths).toContain("index.html");
    });

    it("includes a post page for each mock post", () => {
      const postPaths = filePaths.filter(p => p.startsWith("posts/") && p.endsWith("/index.html"));
      expect(postPaths.length).toBe(MOCK_POSTS.length);
    });

    it("includes sitemap.xml", () => {
      expect(filePaths).toContain("sitemap.xml");
    });

    it("includes rss.xml", () => {
      expect(filePaths).toContain("rss.xml");
    });

    it("includes .nojekyll for GitHub Pages compatibility", () => {
      expect(filePaths).toContain(".nojekyll");
    });

    it("includes GitHub Actions workflow for CI deploys", () => {
      expect(filePaths).toContain(".github/workflows/deploy.yml");
    });

    it("index.html contains the collection name", () => {
      expect(indexHtml).toContain("My Dev Blog");
    });

    it("index.html contains links to each post", () => {
      expect(indexHtml).toContain("Getting Started with TypeScript");
      expect(indexHtml).toContain("React Hooks Deep Dive");
      expect(indexHtml).toContain("Building REST APIs with Next.js");
    });

    it("index.html has inlined CSS (no external stylesheet link)", () => {
      // After inlining, there should be a <style> tag and no href to styles.css
      expect(indexHtml).toContain("<style>");
      expect(indexHtml).not.toMatch(/href="[^"]*styles\.css"/);
    });

    it("index.html has inlined JavaScript (no external script src)", () => {
      // After inlining, there should be a <script> block and no src for script.js
      expect(indexHtml).toContain("<script>");
      expect(indexHtml).not.toMatch(/src="[^"]*script\.js"/);
    });

    it("index.html has proper HTML document structure", () => {
      expect(indexHtml).toContain("<!DOCTYPE html>");
      expect(indexHtml).toContain("<html");
      expect(indexHtml).toContain("<head>");
      expect(indexHtml).toContain("</head>");
      expect(indexHtml).toContain("<body>");
      expect(indexHtml).toContain("</body>");
      expect(indexHtml).toContain("</html>");
    });

    it("index.html has dark mode toggle script", () => {
      // All themes include a dark mode toggle
      expect(indexHtml).toMatch(/dark.?mode|data-theme|theme-toggle/i);
    });

    it("post pages have inlined CSS and JS", async () => {
      const postPath = filePaths.find(p => p.startsWith("posts/") && p.endsWith("/index.html"));
      expect(postPath).toBeTruthy();
      const postHtml = await getZipFileContent(zip, postPath!);
      expect(postHtml).toContain("<style>");
      expect(postHtml).not.toMatch(/href="[^"]*styles\.css"/);
      expect(postHtml).toContain("<script>");
      expect(postHtml).not.toMatch(/src="[^"]*script\.js"/);
    });

    it("post pages contain rendered markdown content", async () => {
      const tsPostPath = filePaths.find(p =>
        p.includes("getting-started") || p.includes("typescript")
      );
      expect(tsPostPath).toBeTruthy();
      const postHtml = await getZipFileContent(zip, tsPostPath!);
      // Rendered markdown should include HTML elements
      expect(postHtml).toContain("<h1");
      expect(postHtml).toContain("<code");
      expect(postHtml).toContain("TypeScript");
    });

    it("post pages include syntax highlighting (highlight.js CDN link)", async () => {
      const postPath = filePaths.find(p => p.startsWith("posts/") && p.endsWith("/index.html"));
      const postHtml = await getZipFileContent(zip, postPath!);
      // highlight.js is loaded from CDN in all themes
      expect(postHtml).toContain("highlight.js");
    });

    it("sitemap.xml is valid XML with urlset", async () => {
      const sitemapXml = await getZipFileContent(zip, "sitemap.xml");
      expect(sitemapXml).toContain('<?xml version="1.0"');
      expect(sitemapXml).toContain("<urlset");
      expect(sitemapXml).toContain("</urlset>");
      expect(sitemapXml).toContain("<loc>");
      expect(sitemapXml).toContain("<lastmod>");
    });

    it("sitemap.xml contains entries for all posts", async () => {
      const sitemapXml = await getZipFileContent(zip, "sitemap.xml");
      // Each post should have a URL entry
      const urlCount = (sitemapXml!.match(/<url>/g) ?? []).length;
      // Posts + index page = MOCK_POSTS.length + 1
      expect(urlCount).toBe(MOCK_POSTS.length + 1);
    });

    it("rss.xml is valid RSS 2.0 feed", async () => {
      const rssXml = await getZipFileContent(zip, "rss.xml");
      expect(rssXml).toContain('<?xml version="1.0"');
      expect(rssXml).toContain('version="2.0"');
      expect(rssXml).toContain("<channel>");
      expect(rssXml).toContain("</channel>");
      expect(rssXml).toContain("<title>");
      expect(rssXml).toContain("<item>");
    });

    it("rss.xml contains entries for all posts", async () => {
      const rssXml = await getZipFileContent(zip, "rss.xml");
      const itemCount = (rssXml!.match(/<item>/g) ?? []).length;
      expect(itemCount).toBe(MOCK_POSTS.length);
    });

    it("GitHub Actions workflow is valid YAML targeting GitHub Pages", async () => {
      const workflow = await getZipFileContent(zip, ".github/workflows/deploy.yml");
      expect(workflow).toContain("actions/configure-pages");
      expect(workflow).toContain("actions/upload-pages-artifact");
      expect(workflow).toContain("actions/deploy-pages");
      expect(workflow).toContain("github-pages");
    });
  });

  describe("Custom domain support", () => {
    it("adds CNAME file when customDomain is provided", async () => {
      const buffer = await buildStaticSiteZip(MOCK_POSTS, {
        themeId: "minimal-portfolio",
        customDomain: "blog.example.com",
      });
      const zip = await loadZip(buffer);
      const cname = await getZipFileContent(zip, "CNAME");
      expect(cname).toBe("blog.example.com");
    });

    it("omits CNAME file when no customDomain is given", async () => {
      const buffer = await buildStaticSiteZip(MOCK_POSTS, {
        themeId: "minimal-portfolio",
      });
      const zip = await loadZip(buffer);
      const filePaths = getZipFilePaths(zip);
      expect(filePaths).not.toContain("CNAME");
    });
  });

  describe("Empty collection edge case", () => {
    it("generates a valid ZIP with no posts", async () => {
      const buffer = await buildStaticSiteZip([], {
        themeId: "technical-blog",
        collectionName: "Empty Blog",
      });
      expect(buffer).toBeInstanceOf(Buffer);
      const zip = await loadZip(buffer);
      const filePaths = getZipFilePaths(zip);
      expect(filePaths).toContain("index.html");
      expect(filePaths).toContain("sitemap.xml");
      expect(filePaths).toContain("rss.xml");
      // No post subdirectories
      const postPages = filePaths.filter(p => p.startsWith("posts/"));
      expect(postPages.length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Sitemap generator unit tests
// ---------------------------------------------------------------------------

describe("Sitemap Generator", () => {
  const BASE_URL = "https://example.com";

  it("generates valid sitemap XML with all posts", () => {
    const xml = generateSitemap(MOCK_POSTS, { baseUrl: BASE_URL });
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("sitemaps.org");
    // 4 posts + 1 index = 5 entries
    const urlCount = (xml.match(/<url>/g) ?? []).length;
    expect(urlCount).toBe(5);
  });

  it("includes the index page entry", () => {
    const xml = generateSitemap(MOCK_POSTS, { baseUrl: BASE_URL, includeIndex: true });
    expect(xml).toContain(`<loc>${BASE_URL}/</loc>`);
    expect(xml).toContain("<priority>1.0</priority>");
  });

  it("excludes the index page when includeIndex is false", () => {
    const xml = generateSitemap(MOCK_POSTS, { baseUrl: BASE_URL, includeIndex: false });
    const urlCount = (xml.match(/<url>/g) ?? []).length;
    expect(urlCount).toBe(MOCK_POSTS.length);
  });

  it("includes post URLs with correct slugs", () => {
    const xml = generateSitemap(MOCK_POSTS, { baseUrl: BASE_URL });
    expect(xml).toContain("getting-started-with-typescript");
    expect(xml).toContain("react-hooks-deep-dive");
  });

  it("includes lastmod dates in YYYY-MM-DD format", () => {
    const xml = generateSitemap(MOCK_POSTS, { baseUrl: BASE_URL });
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });

  it("buildPostSitemapUrl builds correct URL", () => {
    const url = buildPostSitemapUrl(MOCK_POSTS[0]!, BASE_URL);
    expect(url.loc).toBe("https://example.com/posts/getting-started-with-typescript/");
    expect(url.changefreq).toBe("monthly");
    expect(url.priority).toBe("0.8");
  });

  it("buildIndexSitemapUrl builds correct URL", () => {
    const url = buildIndexSitemapUrl(BASE_URL);
    expect(url.loc).toBe("https://example.com/");
    expect(url.changefreq).toBe("weekly");
    expect(url.priority).toBe("1.0");
  });

  it("escapes XML special characters in URLs", () => {
    const postWithAmpersand: ExportablePost = {
      ...MOCK_POSTS[0]!,
      id: "amp-test",
      title: "Cookies & Sessions in Web Apps",
    };
    const xml = generateSitemap([postWithAmpersand], { baseUrl: BASE_URL });
    // The URL itself should use hyphens (no ampersand in slugified URL)
    expect(xml).toContain("cookies-sessions-in-web-apps");
  });
});

// ---------------------------------------------------------------------------
// RSS feed generator unit tests
// ---------------------------------------------------------------------------

describe("RSS Feed Generator", () => {
  const BASE_URL = "https://example.com";
  const FEED_TITLE = "My Dev Blog";

  it("generates valid RSS 2.0 XML", () => {
    const xml = generateRssFeed(MOCK_POSTS, { baseUrl: BASE_URL, title: FEED_TITLE });
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
  });

  it("includes all posts as items", () => {
    const xml = generateRssFeed(MOCK_POSTS, { baseUrl: BASE_URL, title: FEED_TITLE });
    const itemCount = (xml.match(/<item>/g) ?? []).length;
    expect(itemCount).toBe(MOCK_POSTS.length);
  });

  it("sorts posts by date descending (most recent first)", () => {
    const xml = generateRssFeed(MOCK_POSTS, { baseUrl: BASE_URL, title: FEED_TITLE });
    const titleMatches = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].slice(1); // skip channel title
    // v2.0.0 (April) should appear before TypeScript post (January)
    const v2Index = titleMatches.findIndex(m => m[1]?.includes("v2.0.0"));
    const tsIndex = titleMatches.findIndex(m => m[1]?.includes("TypeScript"));
    expect(v2Index).toBeLessThan(tsIndex);
  });

  it("respects maxItems limit", () => {
    const xml = generateRssFeed(MOCK_POSTS, { baseUrl: BASE_URL, title: FEED_TITLE, maxItems: 2 });
    const itemCount = (xml.match(/<item>/g) ?? []).length;
    expect(itemCount).toBe(2);
  });

  it("includes the feed self-link", () => {
    const xml = generateRssFeed(MOCK_POSTS, { baseUrl: BASE_URL, title: FEED_TITLE });
    expect(xml).toContain('rel="self"');
    expect(xml).toContain("feed.xml");
  });

  it("buildRssItem creates correct item structure", () => {
    const item = buildRssItem(MOCK_POSTS[0]!, BASE_URL);
    expect(item.title).toBe("Getting Started with TypeScript");
    expect(item.link).toContain("getting-started-with-typescript");
    expect(item.guid).toBe(item.link);
    expect(item.description.length).toBeGreaterThan(0);
    expect(item.description.length).toBeLessThanOrEqual(201); // 200 chars + ellipsis
  });

  it("strips markdown syntax from descriptions", () => {
    const item = buildRssItem(MOCK_POSTS[1]!, BASE_URL); // React Hooks post
    // Should not contain markdown markers
    expect(item.description).not.toContain("#");
    expect(item.description).not.toContain("```");
    expect(item.description).not.toContain("**");
  });

  it("escapes XML special characters in title and description", () => {
    const postWithSpecialChars: ExportablePost = {
      ...MOCK_POSTS[0]!,
      id: "xml-test",
      title: "Using & in TypeScript: <Types> & \"Generics\"",
      markdown: "Content with & special <characters>",
    };
    const xml = generateRssFeed([postWithSpecialChars], { baseUrl: BASE_URL, title: FEED_TITLE });
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;");
  });
});
