import JSZip from "jszip";
import type { contentTypeEnum, postStatusEnum } from "@sessionforge/db";
import type { SeoMetadata } from "../seo/scoring";
import type { SchemaType } from "../seo/structured-data-generator";

type ContentType = (typeof contentTypeEnum.enumValues)[number];
type PostStatus = (typeof postStatusEnum.enumValues)[number];

export interface ExportablePost {
  id: string;
  title: string;
  markdown: string;
  contentType: ContentType;
  status: PostStatus | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** When true, append an attribution footer to the exported markdown */
  platformFooterEnabled?: boolean;
  /** Session duration in minutes — used in the attribution footer text */
  durationMinutes?: number | null;
  /** Optional SEO metadata to include in frontmatter */
  seoMetadata?: SeoMetadata | null;
  /** Optional structured data type (e.g. "Article", "HowTo") */
  structuredDataType?: SchemaType | null;
  /** Optional JSON-LD string to embed in frontmatter */
  jsonLd?: string | null;
}

export interface ExportFileEntry {
  path: string;
  title: string;
  contentType: ContentType;
  status: PostStatus | null;
  createdAt: string;
}

export interface ExportManifest {
  exportedAt: string;
  totalFiles: number;
  files: ExportFileEntry[];
}

const DIRECTORY_MAP: Record<ContentType, string> = {
  blog_post: "blog",
  devto_post: "blog",
  newsletter: "blog",
  custom: "blog",
  twitter_thread: "social",
  linkedin_post: "social",
  changelog: "changelog",
};

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function getExportDirectory(contentType: ContentType): string {
  return DIRECTORY_MAP[contentType] ?? "blog";
}

function formatDatePrefix(date: Date | null): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildFilename(post: ExportablePost): string {
  const datePrefix = formatDatePrefix(post.createdAt);
  const slug = slugifyTitle(post.title) || post.id.slice(0, 8);
  return `${datePrefix}-${slug}.md`;
}

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

export function buildFrontmatter(post: ExportablePost): string {
  const date = post.createdAt
    ? post.createdAt.toISOString()
    : new Date().toISOString();

  const lines = [
    "---",
    `title: ${JSON.stringify(post.title)}`,
    `date: ${date}`,
    "tags: []",
    `type: ${post.contentType}`,
    `status: ${post.status ?? "draft"}`,
  ];

  // SEO metadata fields
  const seo = post.seoMetadata;
  if (seo) {
    if (seo.metaTitle) {
      lines.push(`meta_title: ${yamlString(seo.metaTitle)}`);
    }
    if (seo.metaDescription) {
      lines.push(`meta_description: ${yamlString(seo.metaDescription)}`);
    }

    const keywordParts: string[] = [];
    if (seo.focusKeyword) {
      keywordParts.push(seo.focusKeyword);
    }
    if (seo.additionalKeywords && seo.additionalKeywords.length > 0) {
      keywordParts.push(...seo.additionalKeywords);
    }
    if (keywordParts.length > 0) {
      lines.push(`keywords: ${yamlStringArray(keywordParts)}`);
    }
  }

  // Structured data fields
  if (post.structuredDataType) {
    lines.push(`structured_data_type: ${yamlString(post.structuredDataType)}`);
  }

  if (post.jsonLd) {
    lines.push(`json_ld: ${yamlString(post.jsonLd)}`);
  }

  lines.push("---");

  return lines.join("\n");
}

function buildAttributionFooter(durationMinutes?: number | null): string {
  const durationPart =
    durationMinutes && durationMinutes > 0
      ? `a real ${durationMinutes}-minute Claude Code coding session`
      : "a real Claude Code coding session";

  return `\n\n---\n\n> This post was forged from ${durationPart}. Verified by [SessionForge](https://sessionforge.ai).`;
}

export function buildMarkdownFile(post: ExportablePost): string {
  const frontmatter = buildFrontmatter(post);
  const body = `${frontmatter}\n\n${post.markdown}`;

  if (!post.platformFooterEnabled) return body;

  return `${body}${buildAttributionFooter(post.durationMinutes)}`;
}

export function buildIndexManifest(
  posts: ExportablePost[],
  files: ExportFileEntry[]
): ExportManifest {
  return {
    exportedAt: new Date().toISOString(),
    totalFiles: files.length,
    files,
  };
}

export async function buildExportZip(posts: ExportablePost[]): Promise<Buffer> {
  const zip = new JSZip();
  const fileEntries: ExportFileEntry[] = [];

  for (const post of posts) {
    const directory = getExportDirectory(post.contentType);
    const filename = buildFilename(post);
    const filePath = `${directory}/${filename}`;
    const fileContent = buildMarkdownFile(post);

    zip.file(filePath, fileContent);

    fileEntries.push({
      path: filePath,
      title: post.title,
      contentType: post.contentType,
      status: post.status,
      createdAt: post.createdAt
        ? post.createdAt.toISOString()
        : new Date().toISOString(),
    });
  }

  const manifest = buildIndexManifest(posts, fileEntries);
  zip.file("index.json", JSON.stringify(manifest, null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer;
}
