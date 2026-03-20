import { describe, it, expect } from "vitest";
import {
  validateBackupBundle,
} from "../../../../src/lib/backup/validator";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
} from "../../../../src/lib/backup/backup-bundle";
import type { BackupBundle } from "../../../../src/lib/backup/backup-bundle";

// ── Shared test data ─────────────────────────────────────────────────────────

const SAMPLE_WORKSPACE = {
  id: "ws-001",
  name: "My Dev Blog",
  slug: "my-dev-blog",
};

const SAMPLE_MANIFEST = {
  bundleFormat: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: new Date("2025-06-01T12:00:00Z").toISOString(),
  postCount: 2,
  seriesCount: 1,
  workspace: SAMPLE_WORKSPACE,
};

const SAMPLE_POSTS = [
  {
    id: "post-001",
    title: "Getting Started with TypeScript",
    markdown: "# TypeScript\n\nGreat language.",
    contentType: "blog_post",
    status: "published",
    keywords: ["typescript"],
    citations: [],
    seoMetadata: null,
    hashnodeUrl: null,
    wordpressPublishedUrl: null,
    publishedAt: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-02T00:00:00Z"),
  },
  {
    id: "post-002",
    title: "Advanced React Patterns",
    markdown: "# React\n\nScalable UIs.",
    contentType: "blog_post",
    status: "draft",
    keywords: null,
    citations: null,
    seoMetadata: null,
    hashnodeUrl: null,
    wordpressPublishedUrl: null,
    publishedAt: null,
    createdAt: new Date("2025-02-01T00:00:00Z"),
    updatedAt: new Date("2025-02-02T00:00:00Z"),
  },
];

const SAMPLE_SERIES = [
  {
    id: "series-001",
    title: "TypeScript Mastery",
    description: null,
    slug: "typescript-mastery",
    coverImage: null,
    isPublic: true,
    posts: [
      { postId: "post-001", order: 1 },
      { postId: "post-002", order: 2 },
    ],
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-02-01T00:00:00Z"),
  },
];

function makeValidBundle(): BackupBundle {
  return {
    manifest: { ...SAMPLE_MANIFEST },
    posts: SAMPLE_POSTS.map((p) => ({ ...p })) as BackupBundle["posts"],
    series: SAMPLE_SERIES.map((s) => ({
      ...s,
      posts: s.posts.map((sp) => ({ ...sp })),
    })) as BackupBundle["series"],
    workspace: { ...SAMPLE_WORKSPACE },
  };
}

// ── Valid bundle ───────────────────────────────────────────────────────────────

describe("validateBackupBundle() — valid bundle", () => {
  it("returns valid:true for a complete, correct bundle", () => {
    const report = validateBackupBundle(makeValidBundle());
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("returns correct postCount", () => {
    const report = validateBackupBundle(makeValidBundle());
    expect(report.postCount).toBe(SAMPLE_POSTS.length);
  });

  it("returns correct seriesCount", () => {
    const report = validateBackupBundle(makeValidBundle());
    expect(report.seriesCount).toBe(SAMPLE_SERIES.length);
  });

  it("returns no errors for a bundle with zero series", () => {
    const bundle = { ...makeValidBundle(), series: [] };
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("returns no errors for a bundle with zero posts", () => {
    const bundle = { ...makeValidBundle(), posts: [], series: [] };
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});

// ── Missing manifest ──────────────────────────────────────────────────────────

describe("validateBackupBundle() — manifest errors", () => {
  it("returns error when manifest is missing", () => {
    const { manifest: _m, ...bundleWithoutManifest } = makeValidBundle();
    const report = validateBackupBundle(bundleWithoutManifest);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("manifest"))).toBe(true);
  });

  it("returns error when manifest is null", () => {
    const bundle = { ...makeValidBundle(), manifest: null };
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("manifest"))).toBe(true);
  });

  it("returns error for unrecognised bundleFormat", () => {
    const bundle = {
      ...makeValidBundle(),
      manifest: { ...SAMPLE_MANIFEST, bundleFormat: "unknown-format" },
    };
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("bundleFormat"))).toBe(true);
  });

  it("returns error when manifest is missing bundleFormat", () => {
    const { bundleFormat: _bf, ...manifestWithout } = SAMPLE_MANIFEST;
    const bundle = { ...makeValidBundle(), manifest: manifestWithout };
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("bundleFormat"))).toBe(true);
  });
});

// ── Version compatibility ─────────────────────────────────────────────────────

describe("validateBackupBundle() — version compatibility", () => {
  it("adds a compatibility note for a version mismatch", () => {
    const bundle = {
      ...makeValidBundle(),
      manifest: { ...SAMPLE_MANIFEST, version: "0.9.0" },
    };
    const report = validateBackupBundle(bundle);
    // Version mismatch is a warning, not an error
    expect(report.compatibilityNotes.length).toBeGreaterThan(0);
    expect(
      report.compatibilityNotes.some((n) => n.includes("0.9.0"))
    ).toBe(true);
  });

  it("does not add a version error for matching version", () => {
    const report = validateBackupBundle(makeValidBundle());
    expect(
      report.compatibilityNotes.some((n) => n.includes("version"))
    ).toBe(false);
  });
});

// ── Post field validation ─────────────────────────────────────────────────────

describe("validateBackupBundle() — post field errors", () => {
  it("returns error when post is missing 'title'", () => {
    const bundle = makeValidBundle();
    const { title: _t, ...postWithoutTitle } = bundle.posts[0] as Record<string, unknown>;
    bundle.posts[0] = postWithoutTitle as BackupBundle["posts"][number];
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("title"))).toBe(true);
  });

  it("returns error when post is missing 'contentType'", () => {
    const bundle = makeValidBundle();
    const { contentType: _ct, ...postWithout } = bundle.posts[0] as Record<string, unknown>;
    bundle.posts[0] = postWithout as BackupBundle["posts"][number];
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("contentType"))).toBe(true);
  });

  it("returns error when post is missing 'id'", () => {
    const bundle = makeValidBundle();
    const { id: _id, ...postWithout } = bundle.posts[0] as Record<string, unknown>;
    bundle.posts[0] = postWithout as BackupBundle["posts"][number];
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("returns error when post is missing 'markdown'", () => {
    const bundle = makeValidBundle();
    const { markdown: _md, ...postWithout } = bundle.posts[0] as Record<string, unknown>;
    bundle.posts[0] = postWithout as BackupBundle["posts"][number];
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("markdown"))).toBe(true);
  });

  it("returns warning when post has empty markdown body", () => {
    const bundle = makeValidBundle();
    (bundle.posts[0] as Record<string, unknown>).markdown = "   ";
    const report = validateBackupBundle(bundle);
    // Empty markdown is a warning, not an error
    expect(report.warnings.some((w) => w.includes("empty"))).toBe(true);
  });

  it("accumulates errors for multiple invalid posts", () => {
    const bundle = makeValidBundle();
    const { title: _t1, ...p1 } = bundle.posts[0] as Record<string, unknown>;
    const { contentType: _ct2, ...p2 } = bundle.posts[1] as Record<string, unknown>;
    bundle.posts[0] = p1 as BackupBundle["posts"][number];
    bundle.posts[1] = p2 as BackupBundle["posts"][number];
    const report = validateBackupBundle(bundle);
    expect(report.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Series reference consistency ──────────────────────────────────────────────

describe("validateBackupBundle() — series reference consistency", () => {
  it("returns error when series references a non-existent postId", () => {
    const bundle = makeValidBundle();
    (bundle.series[0].posts as Array<{ postId: string; order: number }>).push({
      postId: "post-999-does-not-exist",
      order: 99,
    });
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(
      report.errors.some((e) => e.includes("post-999-does-not-exist"))
    ).toBe(true);
  });

  it("passes when all series postIds are present in bundle", () => {
    const report = validateBackupBundle(makeValidBundle());
    expect(report.valid).toBe(true);
    expect(
      report.errors.some((e) => e.includes("does not exist"))
    ).toBe(false);
  });

  it("returns error for series with no posts array", () => {
    const bundle = makeValidBundle();
    const { posts: _p, ...seriesWithout } = bundle.series[0] as Record<string, unknown>;
    bundle.series[0] = seriesWithout as BackupBundle["series"][number];
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("posts array"))).toBe(true);
  });
});

// ── Unknown / extra fields ────────────────────────────────────────────────────

describe("validateBackupBundle() — extra unknown fields", () => {
  it("adds a warning (not error) for unknown manifest fields", () => {
    const bundle = {
      ...makeValidBundle(),
      manifest: {
        ...SAMPLE_MANIFEST,
        unknownExtraField: "some-future-value",
      },
    };
    const report = validateBackupBundle(bundle);
    // Should not produce errors — only warnings for unknown fields
    expect(report.errors.filter((e) => e.includes("unknownExtraField"))).toHaveLength(0);
    expect(
      report.warnings.some((w) => w.includes("unknownExtraField"))
    ).toBe(true);
  });
});

// ── Top-level structure ───────────────────────────────────────────────────────

describe("validateBackupBundle() — top-level structure", () => {
  it("returns error for null input", () => {
    const report = validateBackupBundle(null);
    expect(report.valid).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it("returns error when posts is not an array", () => {
    const bundle = { ...makeValidBundle(), posts: "not-an-array" };
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("posts"))).toBe(true);
  });

  it("returns error when series is not an array", () => {
    const bundle = { ...makeValidBundle(), series: "not-an-array" };
    const report = validateBackupBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("series"))).toBe(true);
  });

  it("returns postCount 0 when posts is missing", () => {
    const { posts: _p, ...bundleWithout } = makeValidBundle();
    const report = validateBackupBundle(bundleWithout);
    expect(report.postCount).toBe(0);
  });

  it("returns seriesCount 0 when series is missing", () => {
    const { series: _s, ...bundleWithout } = makeValidBundle();
    const report = validateBackupBundle(bundleWithout);
    expect(report.seriesCount).toBe(0);
  });
});
