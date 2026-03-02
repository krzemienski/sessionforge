import JSZip from "jszip";
import type { contentTypeEnum, postStatusEnum } from "@sessionforge/db";

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

export function buildFrontmatter(post: ExportablePost): string {
  const date = post.createdAt
    ? post.createdAt.toISOString()
    : new Date().toISOString();

  const lines = [
    "---",
    `title: ${JSON.stringify(post.title)}`,
    `date: ${date}`,
    `type: ${post.contentType}`,
    `status: ${post.status ?? "draft"}`,
    "---",
  ];

  return lines.join("\n");
}

export function buildMarkdownFile(post: ExportablePost): string {
  const frontmatter = buildFrontmatter(post);
  return `${frontmatter}\n\n${post.markdown}`;
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
