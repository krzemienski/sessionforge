import JSZip from "jszip";
import type { contentTypeEnum, postStatusEnum } from "@sessionforge/db";

type ContentType = (typeof contentTypeEnum.enumValues)[number];
type PostStatus = (typeof postStatusEnum.enumValues)[number];

export const BACKUP_FORMAT = "sessionforge-backup";
export const BACKUP_VERSION = "1.0.0";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BackupCitation {
  sessionId: string;
  messageIndex: number;
  text: string;
  type: "tool_call" | "file_edit" | "conversation" | "evidence";
}

export interface BackupSeoMetadata {
  [key: string]: unknown;
}

export interface BackupablePost {
  id: string;
  title: string;
  markdown: string;
  contentType: ContentType;
  status: PostStatus | null;
  keywords: string[] | null;
  citations: BackupCitation[] | null;
  seoMetadata: BackupSeoMetadata | null;
  hashnodeUrl: string | null;
  wordpressPublishedUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BackupSeriesPost {
  postId: string;
  order: number;
}

export interface BackupSeries {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  coverImage: string | null;
  isPublic: boolean | null;
  posts: BackupSeriesPost[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface WorkspaceMetadata {
  id: string;
  name: string;
  slug: string;
}

export interface BackupPostFrontmatter {
  id: string;
  title: string;
  contentType: ContentType;
  status: PostStatus | "draft";
  keywords: string[];
  hashnodeUrl: string | null;
  wordpressPublishedUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  seoMetadata: BackupSeoMetadata | null;
  citations: BackupCitation[];
}

export interface BackupManifest {
  bundleFormat: string;
  version: string;
  exportedAt: string;
  postCount: number;
  seriesCount: number;
  workspace: WorkspaceMetadata;
}

export interface BackupBundle {
  manifest: BackupManifest;
  posts: BackupablePost[];
  series: BackupSeries[];
  workspace: WorkspaceMetadata;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function isoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function isoOrNow(date: Date | null): string {
  return date ? date.toISOString() : new Date().toISOString();
}

function buildPostFilename(post: BackupablePost): string {
  const slug = slugifyTitle(post.title) || post.id.slice(0, 8);
  return `${slug}.md`;
}

export function buildPostFrontmatter(post: BackupablePost): BackupPostFrontmatter {
  return {
    id: post.id,
    title: post.title,
    contentType: post.contentType,
    status: post.status ?? "draft",
    keywords: post.keywords ?? [],
    hashnodeUrl: post.hashnodeUrl ?? null,
    wordpressPublishedUrl: post.wordpressPublishedUrl ?? null,
    publishedAt: isoOrNull(post.publishedAt),
    createdAt: isoOrNow(post.createdAt),
    updatedAt: isoOrNow(post.updatedAt),
    seoMetadata: post.seoMetadata ?? null,
    citations: post.citations ?? [],
  };
}

export function buildPostFileContent(post: BackupablePost): string {
  const frontmatter = buildPostFrontmatter(post);
  const yamlLines = [
    "---",
    `id: ${JSON.stringify(frontmatter.id)}`,
    `title: ${JSON.stringify(frontmatter.title)}`,
    `contentType: ${frontmatter.contentType}`,
    `status: ${frontmatter.status}`,
    `keywords: ${JSON.stringify(frontmatter.keywords)}`,
    `hashnodeUrl: ${frontmatter.hashnodeUrl !== null ? JSON.stringify(frontmatter.hashnodeUrl) : "null"}`,
    `wordpressPublishedUrl: ${frontmatter.wordpressPublishedUrl !== null ? JSON.stringify(frontmatter.wordpressPublishedUrl) : "null"}`,
    `publishedAt: ${frontmatter.publishedAt !== null ? frontmatter.publishedAt : "null"}`,
    `createdAt: ${frontmatter.createdAt}`,
    `updatedAt: ${frontmatter.updatedAt}`,
    `seoMetadata: ${frontmatter.seoMetadata !== null ? JSON.stringify(frontmatter.seoMetadata) : "null"}`,
    `citations: ${JSON.stringify(frontmatter.citations)}`,
    "---",
  ];

  return `${yamlLines.join("\n")}\n\n${post.markdown}`;
}

/** Extract unique image URLs from markdown content */
export function extractImageUrls(markdown: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  // Match markdown images: ![alt](url)
  const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = markdownImageRegex.exec(markdown)) !== null) {
    const url = match[1].trim().split(" ")[0]; // strip optional title
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  // Match HTML img tags: <img src="url" ...>
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlImageRegex.exec(markdown)) !== null) {
    const url = match[1].trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

export function buildManifest(
  posts: BackupablePost[],
  series: BackupSeries[],
  workspace: WorkspaceMetadata
): BackupManifest {
  return {
    bundleFormat: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    postCount: posts.length,
    seriesCount: series.length,
    workspace,
  };
}

// ── Main builder ─────────────────────────────────────────────────────────────

export async function buildBackupBundle(
  posts: BackupablePost[],
  series: BackupSeries[],
  workspace: WorkspaceMetadata
): Promise<Buffer> {
  const zip = new JSZip();

  // manifest.json
  const manifest = buildManifest(posts, series, workspace);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // posts/<slug>.md
  for (const post of posts) {
    const filename = buildPostFilename(post);
    const content = buildPostFileContent(post);
    zip.file(`posts/${filename}`, content);
  }

  // series/series.json
  const seriesData = series.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? null,
    slug: s.slug,
    coverImage: s.coverImage ?? null,
    isPublic: s.isPublic ?? false,
    posts: s.posts,
    createdAt: isoOrNow(s.createdAt),
    updatedAt: isoOrNow(s.updatedAt),
  }));
  zip.file("series/series.json", JSON.stringify(seriesData, null, 2));

  // assets/urls.json — unique image URLs from all posts
  const allMarkdown = posts.map((p) => p.markdown).join("\n");
  const imageUrls = extractImageUrls(allMarkdown);
  zip.file("assets/urls.json", JSON.stringify(imageUrls, null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer;
}
