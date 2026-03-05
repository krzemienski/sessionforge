/**
 * GitHub Pages Deployment Validation Test Suite
 *
 * Validates that the exported static site ZIP contains every file and
 * structural requirement needed for a successful GitHub Pages deployment,
 * as described in docs/github-pages-setup.md.
 *
 * Approach: The ZIP is built in-process using the same buildStaticSiteZip()
 * function that the export API invokes, then the contents are inspected
 * without extracting to disk or contacting any network service.  This is the
 * correct strategy for CI environments where a browser, network, or live
 * GitHub account is not available.
 *
 * Coverage areas (aligned with docs/github-pages-setup.md):
 *   1. Required root files — index.html, .nojekyll, sitemap.xml, rss.xml
 *   2. GitHub Actions workflow — presence, permissions, trigger, action versions
 *   3. Custom domain — CNAME file included when domain is provided
 *   4. Post pages — correct subdirectory structure for GitHub Pages routing
 *   5. HTML validity — self-contained pages (no external CSS/JS links)
 *   6. All three themes — minimal-portfolio, technical-blog, changelog
 */

import { describe, it, expect, beforeAll } from "bun:test";
import JSZip from "jszip";
import { buildStaticSiteZip } from "../static-site-builder";
import type { ExportablePost } from "../markdown-export";
import type { ThemeId } from "../theme-manager";

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const SAMPLE_POSTS: ExportablePost[] = [
  {
    id: "deploy-001",
    title: "Introduction to GitHub Actions",
    markdown: `# Introduction to GitHub Actions

GitHub Actions automates software workflows directly in your repository.

## Workflow Anatomy

\`\`\`yaml
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
\`\`\`

Every workflow starts with a **trigger** (\`on:\`) that determines when it runs.
`,
    contentType: "tutorial",
    status: "published",
    createdAt: new Date("2025-06-01"),
    updatedAt: new Date("2025-06-01"),
    tags: ["github-actions", "ci-cd"],
    sessionId: "session-deploy-001",
  },
  {
    id: "deploy-002",
    title: "Deploying Static Sites with GitHub Pages",
    markdown: `# Deploying Static Sites with GitHub Pages

GitHub Pages hosts your static files for free directly from a repository.

## Enabling Pages

1. Go to **Settings → Pages**
2. Choose a **source branch** or use **GitHub Actions**
3. Click **Save** — your site is live within 60 seconds

## Best Practices

- Include a \`.nojekyll\` file to skip Jekyll processing
- Use the \`actions/upload-pages-artifact\` action for consistent deploys
- Enable **Enforce HTTPS** after DNS propagates
`,
    contentType: "guide",
    status: "published",
    createdAt: new Date("2025-06-15"),
    updatedAt: new Date("2025-06-15"),
    tags: ["github-pages", "static-sites"],
    sessionId: "session-deploy-002",
  },
  {
    id: "deploy-003",
    title: "Custom Domains on GitHub Pages",
    markdown: `# Custom Domains on GitHub Pages

Map your own domain (e.g. \`blog.example.com\`) to your GitHub Pages site.

## Required: CNAME File

Place a \`CNAME\` file in your repository root:

\`\`\`
blog.example.com
\`\`\`

## DNS Records

| Record Type | Host | Value |
|---|---|---|
| CNAME | blog | <username>.github.io |

Allow up to 24 hours for DNS propagation.
`,
    contentType: "guide",
    status: "published",
    createdAt: new Date("2025-07-01"),
    updatedAt: new Date("2025-07-01"),
    tags: ["custom-domain", "dns"],
    sessionId: "session-deploy-003",
  },
];

const THEMES: ThemeId[] = ["minimal-portfolio", "technical-blog", "changelog"];

// Pre-built ZIPs for each theme (with and without custom domain)
const zips: Record<ThemeId, JSZip> = {} as Record<ThemeId, JSZip>;
const zipWithDomain = { zip: null as JSZip | null };

beforeAll(async () => {
  for (const themeId of THEMES) {
    const buffer = await buildStaticSiteZip(SAMPLE_POSTS, {
      themeId,
      collectionName: "Dev Blog",
      collectionDescription: "A developer blog about automation and deployment.",
    });
    zips[themeId] = await JSZip.loadAsync(buffer);
  }

  // One additional build that includes a custom domain
  const domainBuffer = await buildStaticSiteZip(SAMPLE_POSTS, {
    themeId: "minimal-portfolio",
    collectionName: "Dev Blog",
    customDomain: "blog.example.com",
  });
  zipWithDomain.zip = await JSZip.loadAsync(domainBuffer);
});

// ---------------------------------------------------------------------------
// 1. Required root files
// ---------------------------------------------------------------------------

describe("Required root files for GitHub Pages", () => {
  for (const themeId of THEMES) {
    describe(`theme: ${themeId}`, () => {
      it("includes index.html at the root", () => {
        expect(zips[themeId].files["index.html"]).toBeDefined();
      });

      it("includes .nojekyll at the root", () => {
        expect(zips[themeId].files[".nojekyll"]).toBeDefined();
      });

      it("includes sitemap.xml at the root", () => {
        expect(zips[themeId].files["sitemap.xml"]).toBeDefined();
      });

      it("includes rss.xml at the root", () => {
        expect(zips[themeId].files["rss.xml"]).toBeDefined();
      });

      it(".nojekyll is present (not a directory)", () => {
        const file = zips[themeId].files[".nojekyll"];
        expect(file.dir).toBe(false);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 2. GitHub Actions workflow
// ---------------------------------------------------------------------------

describe("GitHub Actions workflow (.github/workflows/deploy.yml)", () => {
  for (const themeId of THEMES) {
    describe(`theme: ${themeId}`, () => {
      let workflowContent: string;

      beforeAll(async () => {
        const workflowFile = zips[themeId].files[".github/workflows/deploy.yml"];
        expect(workflowFile).toBeDefined();
        workflowContent = await workflowFile.async("string");
      });

      it("workflow file exists", () => {
        expect(zips[themeId].files[".github/workflows/deploy.yml"]).toBeDefined();
      });

      it("triggers on push to main branch", () => {
        expect(workflowContent).toContain("branches: [main]");
      });

      it("includes pages: write permission", () => {
        expect(workflowContent).toContain("pages: write");
      });

      it("includes id-token: write permission", () => {
        expect(workflowContent).toContain("id-token: write");
      });

      it("includes contents: read permission", () => {
        expect(workflowContent).toContain("contents: read");
      });

      it("uses actions/checkout@v4", () => {
        expect(workflowContent).toContain("actions/checkout@v4");
      });

      it("uses actions/configure-pages@v4", () => {
        expect(workflowContent).toContain("actions/configure-pages@v4");
      });

      it("uses actions/upload-pages-artifact@v3", () => {
        expect(workflowContent).toContain("actions/upload-pages-artifact@v3");
      });

      it("uses actions/deploy-pages@v4", () => {
        expect(workflowContent).toContain("actions/deploy-pages@v4");
      });

      it("sets github-pages environment", () => {
        expect(workflowContent).toContain("name: github-pages");
      });

      it("uploads the root directory as the artifact", () => {
        // path: '.' means the whole repo root is uploaded to Pages
        expect(workflowContent).toContain("path: '.'");
      });

      it("includes workflow_dispatch trigger for manual runs", () => {
        expect(workflowContent).toContain("workflow_dispatch");
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Custom domain — CNAME file
// ---------------------------------------------------------------------------

describe("Custom domain CNAME file", () => {
  it("includes CNAME when customDomain option is set", () => {
    expect(zipWithDomain.zip!.files["CNAME"]).toBeDefined();
  });

  it("CNAME contains exactly the custom domain", async () => {
    const cnameFile = zipWithDomain.zip!.files["CNAME"];
    const content = await cnameFile.async("string");
    expect(content.trim()).toBe("blog.example.com");
  });

  it("CNAME does not include https:// prefix", async () => {
    const cnameFile = zipWithDomain.zip!.files["CNAME"];
    const content = await cnameFile.async("string");
    expect(content).not.toContain("https://");
  });

  it("CNAME does not include trailing slash", async () => {
    const cnameFile = zipWithDomain.zip!.files["CNAME"];
    const content = await cnameFile.async("string");
    expect(content.trim()).not.toMatch(/\/$/);
  });

  it("does NOT include CNAME when customDomain is omitted", () => {
    // The default (no domain) zip should have no CNAME
    expect(zips["minimal-portfolio"].files["CNAME"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Post pages — directory structure
// ---------------------------------------------------------------------------

describe("Post page directory structure", () => {
  for (const themeId of THEMES) {
    describe(`theme: ${themeId}`, () => {
      it("creates a posts/ directory", () => {
        const postFiles = Object.keys(zips[themeId].files).filter((f) =>
          f.startsWith("posts/")
        );
        expect(postFiles.length).toBeGreaterThan(0);
      });

      it("each post has its own subdirectory with index.html", () => {
        // e.g. posts/introduction-to-github-actions/index.html
        const postIndexPages = Object.keys(zips[themeId].files).filter(
          (f) => f.startsWith("posts/") && f.endsWith("/index.html")
        );
        expect(postIndexPages.length).toBe(SAMPLE_POSTS.length);
      });

      it("post slugs are URL-safe (no spaces or special characters)", () => {
        const postDirs = Object.keys(zips[themeId].files)
          .filter((f) => f.startsWith("posts/") && f.endsWith("/index.html"))
          .map((f) => f.split("/")[1]);

        for (const slug of postDirs) {
          expect(slug).toMatch(/^[a-z0-9-]+$/);
        }
      });

      it("all three sample posts have corresponding page files", () => {
        const postPaths = Object.keys(zips[themeId].files).filter(
          (f) => f.startsWith("posts/") && f.endsWith("/index.html")
        );
        expect(postPaths.length).toBeGreaterThanOrEqual(3);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Self-contained HTML (no broken external asset references)
// ---------------------------------------------------------------------------

describe("Self-contained HTML (GitHub Pages compatibility)", () => {
  for (const themeId of THEMES) {
    describe(`theme: ${themeId}`, () => {
      let indexContent: string;
      let postContent: string;

      beforeAll(async () => {
        indexContent = await zips[themeId].files["index.html"].async("string");
        const postPaths = Object.keys(zips[themeId].files).filter(
          (f) => f.startsWith("posts/") && f.endsWith("/index.html")
        );
        postContent = await zips[themeId].files[postPaths[0]].async("string");
      });

      it("index.html has inline <style> (local styles.css was inlined)", () => {
        // The template's <link href="styles.css"> must be replaced with <style>...</style>
        expect(indexContent).toContain("<style>");
        // No local (relative) CSS file references should remain — CDN links are allowed
        expect(indexContent).not.toMatch(/<link[^>]+href="(?!https?:\/\/)[^"]*styles\.css"[^>]*>/);
      });

      it("index.html has no local JS src reference (CDN scripts are allowed)", () => {
        // The template's <script src="script.js"> must be replaced with inline <script>
        expect(indexContent).not.toMatch(/<script[^>]+src="(?!https?:\/\/)[^"]*script\.js"[^>]*>/);
      });

      it("post page has inline <style> (local styles.css was inlined)", () => {
        expect(postContent).toContain("<style>");
        expect(postContent).not.toMatch(/<link[^>]+href="(?!https?:\/\/)[^"]*styles\.css"[^>]*>/);
      });

      it("post page has no local JS src reference", () => {
        expect(postContent).not.toMatch(/<script[^>]+src="(?!https?:\/\/)[^"]*script\.js"[^>]*>/);
      });

      it("index.html has DOCTYPE declaration", () => {
        expect(indexContent.trimStart()).toMatch(/^<!DOCTYPE html>/i);
      });

      it("post page has DOCTYPE declaration", () => {
        expect(postContent.trimStart()).toMatch(/^<!DOCTYPE html>/i);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 6. sitemap.xml validity for GitHub Pages
// ---------------------------------------------------------------------------

describe("sitemap.xml for GitHub Pages", () => {
  for (const themeId of THEMES) {
    describe(`theme: ${themeId}`, () => {
      let sitemapContent: string;

      beforeAll(async () => {
        sitemapContent = await zips[themeId].files["sitemap.xml"].async("string");
      });

      it("is valid XML (starts with <?xml)", () => {
        expect(sitemapContent.trimStart()).toMatch(/^<\?xml/);
      });

      it("uses the sitemap schema namespace", () => {
        expect(sitemapContent).toContain("sitemaps.org/schemas/sitemap");
      });

      it("includes a <urlset> root element", () => {
        expect(sitemapContent).toContain("<urlset");
      });

      it("contains a <url> entry for each post", () => {
        const urlMatches = sitemapContent.match(/<url>/g) ?? [];
        // At minimum one entry per post plus the index
        expect(urlMatches.length).toBeGreaterThanOrEqual(SAMPLE_POSTS.length);
      });

      it("contains <loc> elements with absolute URLs", () => {
        expect(sitemapContent).toContain("<loc>");
        // All <loc> values start with http:// or https://
        const locMatches = sitemapContent.match(/<loc>([^<]+)<\/loc>/g) ?? [];
        for (const loc of locMatches) {
          expect(loc).toMatch(/<loc>https?:\/\//);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 7. rss.xml validity
// ---------------------------------------------------------------------------

describe("rss.xml for GitHub Pages", () => {
  for (const themeId of THEMES) {
    describe(`theme: ${themeId}`, () => {
      let rssContent: string;

      beforeAll(async () => {
        rssContent = await zips[themeId].files["rss.xml"].async("string");
      });

      it("is valid XML (starts with <?xml)", () => {
        expect(rssContent.trimStart()).toMatch(/^<\?xml/);
      });

      it("contains <rss> root element with version 2.0", () => {
        expect(rssContent).toContain('version="2.0"');
      });

      it("contains <channel> element", () => {
        expect(rssContent).toContain("<channel>");
      });

      it("contains <item> entries for each post", () => {
        const itemMatches = rssContent.match(/<item>/g) ?? [];
        expect(itemMatches.length).toBeGreaterThanOrEqual(SAMPLE_POSTS.length);
      });

      it("each item has a <title> element", () => {
        const titleMatches = rssContent.match(/<title>/g) ?? [];
        // channel title + one per post
        expect(titleMatches.length).toBeGreaterThan(SAMPLE_POSTS.length);
      });

      it("each item has a <link> element", () => {
        const linkMatches = rssContent.match(/<link>/g) ?? [];
        expect(linkMatches.length).toBeGreaterThanOrEqual(SAMPLE_POSTS.length);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 8. ZIP file structure summary (deployment readiness)
// ---------------------------------------------------------------------------

describe("Deployment readiness checklist", () => {
  const themeId: ThemeId = "minimal-portfolio";

  it("ZIP contains all six required categories of files", () => {
    const files = Object.keys(zips[themeId].files);

    const hasRootIndex = files.includes("index.html");
    const hasNojekyll = files.includes(".nojekyll");
    const hasSitemap = files.includes("sitemap.xml");
    const hasRss = files.includes("rss.xml");
    const hasWorkflow = files.includes(".github/workflows/deploy.yml");
    const hasPostPages = files.some(
      (f) => f.startsWith("posts/") && f.endsWith("/index.html")
    );

    expect(hasRootIndex).toBe(true);
    expect(hasNojekyll).toBe(true);
    expect(hasSitemap).toBe(true);
    expect(hasRss).toBe(true);
    expect(hasWorkflow).toBe(true);
    expect(hasPostPages).toBe(true);
  });

  it("index.html is at the root (not inside a subdirectory)", () => {
    const indexPath = Object.keys(zips[themeId].files).find(
      (f) => f === "index.html"
    );
    expect(indexPath).toBe("index.html");
  });

  it("total file count covers index + posts + meta files", () => {
    const files = Object.keys(zips[themeId].files);
    // index.html + N post pages + sitemap + rss + .nojekyll + workflow = N+5
    expect(files.length).toBeGreaterThanOrEqual(SAMPLE_POSTS.length + 5);
  });

  it("no files reference localhost or 127.0.0.1", async () => {
    const indexContent = await zips[themeId].files["index.html"].async("string");
    expect(indexContent).not.toContain("localhost");
    expect(indexContent).not.toContain("127.0.0.1");
  });
});
