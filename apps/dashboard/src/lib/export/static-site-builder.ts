import JSZip from "jszip";
import { marked } from "marked";
import type { ThemeId, ThemeConfig } from "./theme-manager";
import {
  loadThemeFiles,
  buildThemeVariables,
  applyTemplateVariables,
  defaultThemeConfig,
} from "./theme-manager";
import { slugifyTitle, getExportDirectory } from "./markdown-export";
import type { ExportablePost } from "./markdown-export";

export interface StaticSiteOptions {
  themeId: ThemeId;
  themeConfig?: Partial<ThemeConfig>;
  /** Custom domain for CNAME file — omit to skip */
  customDomain?: string;
  /** Collection display name shown on index page */
  collectionName?: string;
  /** Collection description shown on index page */
  collectionDescription?: string;
}

export interface BuiltPage {
  /** Output path inside ZIP (e.g. "posts/2024-01-01-my-post/index.html") */
  path: string;
  /** Slug used for internal linking */
  slug: string;
  /** Original post */
  post: ExportablePost;
}

/** Format a Date to a human-readable string, e.g. "January 1, 2024" */
function formatDate(date: Date | null): string {
  const d = date ?? new Date();
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Format a Date to YYYY-MM-DD for ISO attributes */
function formatDateIso(date: Date | null): string {
  const d = date ?? new Date();
  return d.toISOString();
}

/** Convert markdown to HTML using marked */
function renderMarkdown(markdown: string): string {
  const result = marked(markdown);
  // marked can return string | Promise<string>; we call synchronously
  return typeof result === "string" ? result : "";
}

/** Build a slug-based post directory path (no extension — contains index.html) */
function buildPostSlug(post: ExportablePost): string {
  const slug = slugifyTitle(post.title) || post.id.slice(0, 8);
  return slug;
}

/** Build the HTML <li> entry for a post in the index listing */
function buildPostListItem(
  post: ExportablePost,
  slug: string,
  baseUrl: string
): string {
  const href = baseUrl ? `${baseUrl}/posts/${slug}/` : `posts/${slug}/`;
  const date = formatDate(post.createdAt);
  const dateIso = formatDateIso(post.createdAt);
  return [
    `<article class="post-card">`,
    `  <time datetime="${dateIso}" class="post-date">${date}</time>`,
    `  <h2 class="post-title"><a href="${href}">${escapeHtml(post.title)}</a></h2>`,
    `</article>`,
  ].join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Render a single post page HTML */
async function renderPostPage(
  post: ExportablePost,
  themeId: ThemeId,
  config: ThemeConfig,
  baseUrl: string
): Promise<string> {
  const { html, css, js } = await loadThemeFiles(themeId);
  const postContent = renderMarkdown(post.markdown);
  const postDateIso = formatDateIso(post.createdAt);
  const postDateFormatted = formatDate(post.createdAt);

  const variables = buildThemeVariables(config, {
    PAGE_TITLE: `${post.title} — ${config.siteTitle}`,
    CANONICAL_URL: baseUrl
      ? `${baseUrl}/posts/${buildPostSlug(post)}/`
      : "",
    OG_TYPE: "article",
    NAV_HOME_ACTIVE: "",
    IS_INDEX: false,
    IS_POST: true,
    POST_TITLE: post.title,
    POST_DATE_ISO: postDateIso,
    POST_DATE_FORMATTED: postDateFormatted,
    POST_TAGS: "",
    POST_CONTENT: postContent,
    // Inline CSS and JS for self-contained pages
    POSTS_LIST: "",
    COLLECTION_NAME: "",
    COLLECTION_DESCRIPTION: "",
  });

  // Inject CSS and JS inline so pages are fully self-contained
  let rendered = applyTemplateVariables(html, variables);
  rendered = rendered.replace(
    '<link rel="stylesheet" href="styles.css">',
    `<style>${css}</style>`
  );
  rendered = rendered.replace(
    '<script src="script.js"></script>',
    `<script>${js}</script>`
  );

  return rendered;
}

/** Render the index (listing) page HTML */
async function renderIndexPage(
  posts: ExportablePost[],
  builtPages: BuiltPage[],
  themeId: ThemeId,
  config: ThemeConfig,
  options: StaticSiteOptions
): Promise<string> {
  const { html, css, js } = await loadThemeFiles(themeId);
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  const postsList = builtPages
    .map(({ post, slug }) => buildPostListItem(post, slug, baseUrl))
    .join("\n");

  const variables = buildThemeVariables(config, {
    PAGE_TITLE: config.siteTitle,
    CANONICAL_URL: baseUrl || "",
    OG_TYPE: "website",
    NAV_HOME_ACTIVE: "aria-current=\"page\"",
    IS_INDEX: true,
    IS_POST: false,
    COLLECTION_NAME: options.collectionName ?? config.siteTitle,
    COLLECTION_DESCRIPTION:
      options.collectionDescription ?? config.siteDescription,
    POSTS_LIST: postsList,
    POST_TITLE: "",
    POST_DATE_ISO: "",
    POST_DATE_FORMATTED: "",
    POST_TAGS: "",
    POST_CONTENT: "",
  });

  let rendered = applyTemplateVariables(html, variables);
  rendered = rendered.replace(
    '<link rel="stylesheet" href="styles.css">',
    `<style>${css}</style>`
  );
  rendered = rendered.replace(
    '<script src="script.js"></script>',
    `<script>${js}</script>`
  );

  return rendered;
}

/** Build a GitHub Actions workflow YAML for CI deploys to GitHub Pages */
function buildGithubPagesWorkflow(repoName: string): string {
  return `name: Deploy Static Site

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
}

/** Assemble the complete static site ZIP */
export async function buildStaticSiteZip(
  posts: ExportablePost[],
  options: StaticSiteOptions
): Promise<Buffer> {
  const zip = new JSZip();
  const config = defaultThemeConfig(options.themeConfig);
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  // Build post pages
  const builtPages: BuiltPage[] = [];

  for (const post of posts) {
    const slug = buildPostSlug(post);
    const pagePath = `posts/${slug}/index.html`;

    const pageHtml = await renderPostPage(post, options.themeId, config, baseUrl);
    zip.file(pagePath, pageHtml);

    builtPages.push({ path: pagePath, slug, post });
  }

  // Build index page
  const indexHtml = await renderIndexPage(
    posts,
    builtPages,
    options.themeId,
    config,
    options
  );
  zip.file("index.html", indexHtml);

  // CNAME for custom domain support
  if (options.customDomain) {
    zip.file("CNAME", options.customDomain.trim());
  }

  // GitHub Actions workflow for CI deploys
  zip.file(
    ".github/workflows/deploy.yml",
    buildGithubPagesWorkflow(config.siteTitle)
  );

  // .nojekyll to prevent GitHub Pages from ignoring _ directories
  zip.file(".nojekyll", "");

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer;
}

/** Return the MIME type and filename for the static site download */
export function staticSiteDownloadHeaders(siteTitle: string): {
  contentType: string;
  filename: string;
} {
  const slug = slugifyTitle(siteTitle) || "static-site";
  return {
    contentType: "application/zip",
    filename: `${slug}-static-site.zip`,
  };
}
