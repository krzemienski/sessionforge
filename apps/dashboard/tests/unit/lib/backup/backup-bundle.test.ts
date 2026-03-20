import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import {
  buildBackupBundle,
  buildPostFileContent,
  buildPostFrontmatter,
  extractImageUrls,
  buildManifest,
  BACKUP_FORMAT,
  BACKUP_VERSION,
} from "../../../../src/lib/backup/backup-bundle";
import type {
  BackupablePost,
  BackupSeries,
  WorkspaceMetadata,
} from "../../../../src/lib/backup/backup-bundle";

// ── Shared test data ─────────────────────────────────────────────────────────

const SAMPLE_WORKSPACE: WorkspaceMetadata = {
  id: "ws-001",
  name: "My Dev Blog",
  slug: "my-dev-blog",
};

const SAMPLE_POSTS: BackupablePost[] = [
  {
    id: "post-001",
    title: "Getting Started with TypeScript",
    markdown: `# Getting Started with TypeScript

TypeScript adds static typing to JavaScript.

![diagram](https://example.com/ts-diagram.png)
`,
    contentType: "blog_post",
    status: "published",
    keywords: ["typescript", "javascript", "types"],
    citations: [
      {
        sessionId: "sess-001",
        messageIndex: 0,
        text: "TypeScript is a typed superset of JavaScript",
        type: "conversation",
      },
    ],
    seoMetadata: { metaTitle: "TypeScript Guide", metaDescription: "Learn TypeScript" },
    hashnodeUrl: "https://hashnode.com/post/ts-guide",
    wordpressPublishedUrl: null,
    publishedAt: new Date("2025-01-15T12:00:00Z"),
    createdAt: new Date("2025-01-10T10:00:00Z"),
    updatedAt: new Date("2025-01-14T15:00:00Z"),
  },
  {
    id: "post-002",
    title: "Advanced React Patterns",
    markdown: `# Advanced React Patterns

React patterns for building scalable UIs.

<img src="https://example.com/react-patterns.jpg" alt="React Patterns" />
![another](https://example.com/ts-diagram.png)
`,
    contentType: "blog_post",
    status: "draft",
    keywords: null,
    citations: null,
    seoMetadata: null,
    hashnodeUrl: null,
    wordpressPublishedUrl: "https://mysite.wordpress.com/react-patterns",
    publishedAt: null,
    createdAt: new Date("2025-02-01T09:00:00Z"),
    updatedAt: new Date("2025-02-05T11:00:00Z"),
  },
  {
    id: "post-003",
    title: "Node.js Performance Tips",
    markdown: `# Node.js Performance Tips

Improve your Node.js app performance.
`,
    contentType: "newsletter",
    status: "archived",
    keywords: ["nodejs", "performance"],
    citations: [],
    seoMetadata: null,
    hashnodeUrl: null,
    wordpressPublishedUrl: null,
    publishedAt: new Date("2024-12-01T08:00:00Z"),
    createdAt: new Date("2024-11-20T07:00:00Z"),
    updatedAt: new Date("2024-11-30T18:00:00Z"),
  },
];

const SAMPLE_SERIES: BackupSeries[] = [
  {
    id: "series-001",
    title: "TypeScript Mastery",
    description: "Complete guide to TypeScript",
    slug: "typescript-mastery",
    coverImage: "https://example.com/ts-cover.jpg",
    isPublic: true,
    posts: [
      { postId: "post-001", order: 1 },
      { postId: "post-002", order: 2 },
    ],
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-02-01T00:00:00Z"),
  },
];

// Pre-built ZIP for all tests
let zip: JSZip;

beforeAll(async () => {
  const buffer = await buildBackupBundle(
    SAMPLE_POSTS,
    SAMPLE_SERIES,
    SAMPLE_WORKSPACE
  );
  zip = await JSZip.loadAsync(buffer);
});

// ── manifest.json ────────────────────────────────────────────────────────────

describe("manifest.json", () => {
  let manifest: Record<string, unknown>;

  beforeAll(async () => {
    const file = zip.files["manifest.json"];
    expect(file).toBeDefined();
    const content = await file.async("string");
    manifest = JSON.parse(content);
  });

  it("has bundleFormat field", () => {
    expect(manifest.bundleFormat).toBe(BACKUP_FORMAT);
  });

  it("has version field", () => {
    expect(manifest.version).toBe(BACKUP_VERSION);
  });

  it("has exportedAt field as ISO string", () => {
    expect(typeof manifest.exportedAt).toBe("string");
    expect(() => new Date(manifest.exportedAt as string)).not.toThrow();
  });

  it("has correct postCount", () => {
    expect(manifest.postCount).toBe(SAMPLE_POSTS.length);
  });

  it("has correct seriesCount", () => {
    expect(manifest.seriesCount).toBe(SAMPLE_SERIES.length);
  });

  it("includes workspace metadata", () => {
    expect(manifest.workspace).toMatchObject({
      id: SAMPLE_WORKSPACE.id,
      name: SAMPLE_WORKSPACE.name,
      slug: SAMPLE_WORKSPACE.slug,
    });
  });
});

// ── posts/ directory ─────────────────────────────────────────────────────────

describe("posts/ directory", () => {
  it("ZIP contains posts/ directory with files", () => {
    const postFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith("posts/") && !zip.files[f].dir
    );
    expect(postFiles.length).toBe(SAMPLE_POSTS.length);
  });

  it("each post has a corresponding .md file", () => {
    for (const post of SAMPLE_POSTS) {
      const postFiles = Object.keys(zip.files).filter(
        (f) => f.startsWith("posts/") && f.endsWith(".md")
      );
      // At least one post file should exist
      expect(postFiles.length).toBeGreaterThan(0);
    }
  });

  it("post filenames are URL-safe slugs", () => {
    const postFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith("posts/") && f.endsWith(".md")
    );
    for (const filePath of postFiles) {
      const filename = filePath.replace("posts/", "").replace(".md", "");
      expect(filename).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

// ── Post file frontmatter ────────────────────────────────────────────────────

describe("post file frontmatter", () => {
  let postContent: string;
  let post2Content: string;

  beforeAll(async () => {
    const postFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith("posts/") && f.endsWith(".md")
    );
    // Sort by filename for deterministic ordering
    postFiles.sort();
    const firstFile = zip.files[postFiles[0]];
    postContent = await firstFile.async("string");

    if (postFiles.length > 1) {
      const secondFile = zip.files[postFiles[1]];
      post2Content = await secondFile.async("string");
    }
  });

  it("post file starts with frontmatter delimiter ---", () => {
    expect(postContent.trimStart()).toMatch(/^---\n/);
  });

  it("post file contains id field", () => {
    expect(postContent).toMatch(/^id:/m);
  });

  it("post file contains title field", () => {
    expect(postContent).toMatch(/^title:/m);
  });

  it("post file contains contentType field", () => {
    expect(postContent).toMatch(/^contentType:/m);
  });

  it("post file contains status field", () => {
    expect(postContent).toMatch(/^status:/m);
  });

  it("post file contains keywords field", () => {
    expect(postContent).toMatch(/^keywords:/m);
  });

  it("post file contains hashnodeUrl field", () => {
    expect(postContent).toMatch(/^hashnodeUrl:/m);
  });

  it("post file contains wordpressPublishedUrl field", () => {
    expect(postContent).toMatch(/^wordpressPublishedUrl:/m);
  });

  it("post file contains publishedAt field", () => {
    expect(postContent).toMatch(/^publishedAt:/m);
  });

  it("post file contains createdAt field", () => {
    expect(postContent).toMatch(/^createdAt:/m);
  });

  it("post file contains updatedAt field", () => {
    expect(postContent).toMatch(/^updatedAt:/m);
  });

  it("post file contains seoMetadata field", () => {
    expect(postContent).toMatch(/^seoMetadata:/m);
  });

  it("post file contains citations field", () => {
    expect(postContent).toMatch(/^citations:/m);
  });

  it("post file body contains the original markdown content", () => {
    // After the closing --- the markdown content follows
    expect(postContent).toContain("# ");
  });
});

// ── buildPostFrontmatter helper ───────────────────────────────────────────────

describe("buildPostFrontmatter()", () => {
  it("uses 'draft' status when post.status is null", () => {
    const post: BackupablePost = {
      ...SAMPLE_POSTS[0],
      status: null,
    };
    const fm = buildPostFrontmatter(post);
    expect(fm.status).toBe("draft");
  });

  it("preserves keywords as empty array when null", () => {
    const post: BackupablePost = {
      ...SAMPLE_POSTS[1],
      keywords: null,
    };
    const fm = buildPostFrontmatter(post);
    expect(fm.keywords).toEqual([]);
  });

  it("preserves citations as empty array when null", () => {
    const post: BackupablePost = {
      ...SAMPLE_POSTS[1],
      citations: null,
    };
    const fm = buildPostFrontmatter(post);
    expect(fm.citations).toEqual([]);
  });

  it("serializes publishedAt as ISO string", () => {
    const fm = buildPostFrontmatter(SAMPLE_POSTS[0]);
    expect(fm.publishedAt).toBe("2025-01-15T12:00:00.000Z");
  });

  it("sets publishedAt to null when not provided", () => {
    const fm = buildPostFrontmatter(SAMPLE_POSTS[1]);
    expect(fm.publishedAt).toBeNull();
  });

  it("includes all provided seoMetadata fields", () => {
    const fm = buildPostFrontmatter(SAMPLE_POSTS[0]);
    expect(fm.seoMetadata).toMatchObject({
      metaTitle: "TypeScript Guide",
      metaDescription: "Learn TypeScript",
    });
  });

  it("sets seoMetadata to null when not provided", () => {
    const fm = buildPostFrontmatter(SAMPLE_POSTS[1]);
    expect(fm.seoMetadata).toBeNull();
  });
});

// ── series/series.json ────────────────────────────────────────────────────────

describe("series/series.json", () => {
  let seriesData: unknown[];

  beforeAll(async () => {
    const file = zip.files["series/series.json"];
    expect(file).toBeDefined();
    const content = await file.async("string");
    seriesData = JSON.parse(content);
  });

  it("is an array", () => {
    expect(Array.isArray(seriesData)).toBe(true);
  });

  it("has correct number of series", () => {
    expect(seriesData.length).toBe(SAMPLE_SERIES.length);
  });

  it("each series has id, title, slug fields", () => {
    for (const s of seriesData as Record<string, unknown>[]) {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("title");
      expect(s).toHaveProperty("slug");
    }
  });

  it("each series includes posts array with postId and order", () => {
    const firstSeries = seriesData[0] as Record<string, unknown>;
    expect(Array.isArray(firstSeries.posts)).toBe(true);
    const posts = firstSeries.posts as Record<string, unknown>[];
    expect(posts.length).toBe(SAMPLE_SERIES[0].posts.length);
    expect(posts[0]).toHaveProperty("postId");
    expect(posts[0]).toHaveProperty("order");
  });

  it("series includes description, coverImage, isPublic fields", () => {
    const firstSeries = seriesData[0] as Record<string, unknown>;
    expect(firstSeries).toHaveProperty("description");
    expect(firstSeries).toHaveProperty("coverImage");
    expect(firstSeries).toHaveProperty("isPublic");
  });

  it("series includes createdAt and updatedAt timestamps", () => {
    const firstSeries = seriesData[0] as Record<string, unknown>;
    expect(typeof firstSeries.createdAt).toBe("string");
    expect(typeof firstSeries.updatedAt).toBe("string");
  });

  it("empty series array produces valid empty JSON array", async () => {
    const buffer = await buildBackupBundle(
      SAMPLE_POSTS,
      [],
      SAMPLE_WORKSPACE
    );
    const emptyZip = await JSZip.loadAsync(buffer);
    const content = await emptyZip.files["series/series.json"].async("string");
    const parsed = JSON.parse(content);
    expect(parsed).toEqual([]);
  });
});

// ── assets/urls.json ──────────────────────────────────────────────────────────

describe("assets/urls.json", () => {
  let imageUrls: unknown[];

  beforeAll(async () => {
    const file = zip.files["assets/urls.json"];
    expect(file).toBeDefined();
    const content = await file.async("string");
    imageUrls = JSON.parse(content);
  });

  it("is an array", () => {
    expect(Array.isArray(imageUrls)).toBe(true);
  });

  it("contains URLs extracted from post markdown", () => {
    expect(imageUrls).toContain("https://example.com/ts-diagram.png");
    expect(imageUrls).toContain("https://example.com/react-patterns.jpg");
  });

  it("URLs are unique (no duplicates)", () => {
    const set = new Set(imageUrls);
    expect(set.size).toBe(imageUrls.length);
  });

  it("ts-diagram.png appears only once despite being in two posts", () => {
    const tsCount = (imageUrls as string[]).filter(
      (u) => u === "https://example.com/ts-diagram.png"
    ).length;
    expect(tsCount).toBe(1);
  });
});

// ── extractImageUrls helper ───────────────────────────────────────────────────

describe("extractImageUrls()", () => {
  it("extracts markdown image syntax URLs", () => {
    const md = "Some text ![alt text](https://cdn.example.com/img.png) here";
    expect(extractImageUrls(md)).toContain("https://cdn.example.com/img.png");
  });

  it("extracts HTML img src URLs", () => {
    const md = '<img src="https://cdn.example.com/photo.jpg" alt="photo" />';
    expect(extractImageUrls(md)).toContain("https://cdn.example.com/photo.jpg");
  });

  it("deduplicates the same URL", () => {
    const md = [
      "![img](https://example.com/same.png)",
      "![img2](https://example.com/same.png)",
    ].join("\n");
    const urls = extractImageUrls(md);
    expect(urls.filter((u) => u === "https://example.com/same.png").length).toBe(1);
  });

  it("returns empty array for markdown with no images", () => {
    expect(extractImageUrls("No images here, just text.")).toEqual([]);
  });
});

// ── buildManifest helper ─────────────────────────────────────────────────────

describe("buildManifest()", () => {
  it("sets bundleFormat to BACKUP_FORMAT constant", () => {
    const m = buildManifest(SAMPLE_POSTS, SAMPLE_SERIES, SAMPLE_WORKSPACE);
    expect(m.bundleFormat).toBe(BACKUP_FORMAT);
  });

  it("sets version to BACKUP_VERSION constant", () => {
    const m = buildManifest(SAMPLE_POSTS, SAMPLE_SERIES, SAMPLE_WORKSPACE);
    expect(m.version).toBe(BACKUP_VERSION);
  });

  it("postCount matches posts array length", () => {
    const m = buildManifest(SAMPLE_POSTS, SAMPLE_SERIES, SAMPLE_WORKSPACE);
    expect(m.postCount).toBe(SAMPLE_POSTS.length);
  });

  it("seriesCount matches series array length", () => {
    const m = buildManifest(SAMPLE_POSTS, SAMPLE_SERIES, SAMPLE_WORKSPACE);
    expect(m.seriesCount).toBe(SAMPLE_SERIES.length);
  });

  it("exportedAt is a valid ISO timestamp", () => {
    const m = buildManifest(SAMPLE_POSTS, SAMPLE_SERIES, SAMPLE_WORKSPACE);
    expect(new Date(m.exportedAt).toISOString()).toBe(m.exportedAt);
  });
});

// ── ZIP structure ─────────────────────────────────────────────────────────────

describe("ZIP file structure", () => {
  it("contains manifest.json at root", () => {
    expect(zip.files["manifest.json"]).toBeDefined();
  });

  it("contains series/series.json", () => {
    expect(zip.files["series/series.json"]).toBeDefined();
  });

  it("contains assets/urls.json", () => {
    expect(zip.files["assets/urls.json"]).toBeDefined();
  });

  it("posts directory contains .md files", () => {
    const mdFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith("posts/") && f.endsWith(".md")
    );
    expect(mdFiles.length).toBeGreaterThan(0);
  });

  it("returns a Buffer", async () => {
    const buffer = await buildBackupBundle(
      SAMPLE_POSTS,
      SAMPLE_SERIES,
      SAMPLE_WORKSPACE
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("handles empty posts array gracefully", async () => {
    const buffer = await buildBackupBundle([], [], SAMPLE_WORKSPACE);
    const emptyZip = await JSZip.loadAsync(buffer);
    expect(emptyZip.files["manifest.json"]).toBeDefined();

    const manifestContent = await emptyZip.files["manifest.json"].async("string");
    const manifest = JSON.parse(manifestContent);
    expect(manifest.postCount).toBe(0);
    expect(manifest.seriesCount).toBe(0);
  });
});
