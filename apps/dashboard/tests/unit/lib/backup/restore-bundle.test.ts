import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BackupBundle } from "../../../../src/lib/backup/backup-bundle";
import type { RestoreOptions } from "../../../../src/lib/backup/restore-bundle";

// ── Mock setup (hoisted so it runs before any module imports) ─────────────────

const { mockInsert, mockValues } = vi.hoisted(() => {
  const mockValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  return { mockInsert, mockValues };
});

vi.mock("@/lib/db", () => ({
  db: {
    insert: mockInsert,
  },
}));

// Import function under test AFTER mock declarations
import { restoreBackupBundle } from "../../../../src/lib/backup/restore-bundle";

// ── Shared test data ──────────────────────────────────────────────────────────

const SAMPLE_BUNDLE: BackupBundle = {
  manifest: {
    bundleFormat: "sessionforge-backup",
    version: "1.0.0",
    exportedAt: new Date("2025-06-01T12:00:00Z").toISOString(),
    postCount: 2,
    seriesCount: 1,
    workspace: { id: "ws-source-001", name: "Source Blog", slug: "source-blog" },
  },
  posts: [
    {
      id: "backup-post-001",
      title: "Getting Started with TypeScript",
      markdown: "# TypeScript\n\nGreat language.",
      contentType: "blog_post",
      status: "published",
      keywords: ["typescript", "javascript"],
      citations: [
        { sessionId: "sess-001", messageIndex: 0, text: "TS is typed JS", type: "conversation" },
      ],
      seoMetadata: { metaTitle: "TS Guide" },
      hashnodeUrl: "https://hashnode.com/post/ts-001",
      wordpressPublishedUrl: null,
      publishedAt: new Date("2025-01-15T12:00:00Z"),
      createdAt: new Date("2025-01-10T10:00:00Z"),
      updatedAt: new Date("2025-01-14T15:00:00Z"),
    },
    {
      id: "backup-post-002",
      title: "Advanced React Patterns",
      markdown: "# React\n\nScalable UIs.",
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
  ],
  series: [
    {
      id: "backup-series-001",
      title: "TypeScript Mastery",
      description: "Complete guide to TypeScript",
      slug: "typescript-mastery",
      coverImage: "https://example.com/ts-cover.jpg",
      isPublic: true,
      posts: [
        { postId: "backup-post-001", order: 1 },
        { postId: "backup-post-002", order: 2 },
      ],
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-02-01T00:00:00Z"),
    },
  ],
  workspace: { id: "ws-source-001", name: "Source Blog", slug: "source-blog" },
};

const RESTORE_OPTIONS: RestoreOptions = {
  workspaceId: "ws-target-999",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("restoreBackupBundle()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
  });

  // ── Post creation ──────────────────────────────────────────────────────────

  describe("post creation", () => {
    it("creates one DB insert per post in the bundle", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      // 2 posts + 1 series + 2 series_posts = 5 total inserts
      const insertCalls = mockInsert.mock.calls.length;
      expect(insertCalls).toBeGreaterThanOrEqual(SAMPLE_BUNDLE.posts.length);
    });

    it("returns postsCreated matching the number of posts in the bundle", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      expect(summary.postsCreated).toBe(SAMPLE_BUNDLE.posts.length);
    });

    it("returns postsFailed = 0 when all inserts succeed", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      expect(summary.postsFailed).toBe(0);
    });

    it("inserts posts with the target workspaceId, not the source workspace ID", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      // All .values() calls should include the target workspaceId
      const valuesCalls = mockValues.mock.calls;
      const postValuesCalls = valuesCalls.filter(
        (call) => call[0].workspaceId !== undefined && call[0].title !== undefined
      );
      for (const call of postValuesCalls) {
        if (call[0].title !== undefined) {
          expect(call[0].workspaceId).toBe(RESTORE_OPTIONS.workspaceId);
        }
      }
    });

    it("generates new IDs distinct from the original backup post IDs", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      for (const [oldId, newId] of Object.entries(summary.idMap)) {
        expect(newId).not.toBe(oldId);
        expect(newId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
      }
    });

    it("preserves post title, markdown, and contentType", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const firstPostValues = mockValues.mock.calls.find(
        (call) => call[0].title === "Getting Started with TypeScript"
      );
      expect(firstPostValues).toBeDefined();
      expect(firstPostValues![0].markdown).toBe("# TypeScript\n\nGreat language.");
      expect(firstPostValues![0].contentType).toBe("blog_post");
    });

    it("falls back to 'draft' status when post.status is null", async () => {
      const bundleWithNullStatus: BackupBundle = {
        ...SAMPLE_BUNDLE,
        posts: [{ ...SAMPLE_BUNDLE.posts[0], status: null }],
        series: [],
      };
      await restoreBackupBundle(bundleWithNullStatus, RESTORE_OPTIONS);

      const postValues = mockValues.mock.calls[0][0];
      expect(postValues.status).toBe("draft");
    });

    it("sets keywords to empty array when post.keywords is null", async () => {
      const bundleWithNullKeywords: BackupBundle = {
        ...SAMPLE_BUNDLE,
        posts: [{ ...SAMPLE_BUNDLE.posts[0], keywords: null }],
        series: [],
      };
      await restoreBackupBundle(bundleWithNullKeywords, RESTORE_OPTIONS);

      const postValues = mockValues.mock.calls[0][0];
      expect(postValues.keywords).toEqual([]);
    });

    it("sets citations to empty array when post.citations is null", async () => {
      const bundleWithNullCitations: BackupBundle = {
        ...SAMPLE_BUNDLE,
        posts: [{ ...SAMPLE_BUNDLE.posts[0], citations: null }],
        series: [],
      };
      await restoreBackupBundle(bundleWithNullCitations, RESTORE_OPTIONS);

      const postValues = mockValues.mock.calls[0][0];
      expect(postValues.citations).toEqual([]);
    });
  });

  // ── sourceMetadata ─────────────────────────────────────────────────────────

  describe("sourceMetadata", () => {
    it("sets sourceMetadata.generatedBy = 'manual' on every restored post", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const postValuesCalls = mockValues.mock.calls.filter(
        (call) => call[0].sourceMetadata !== undefined
      );
      for (const call of postValuesCalls) {
        expect(call[0].sourceMetadata.generatedBy).toBe("manual");
      }
    });

    it("stores the original backup post ID in sourceMetadata.backupSourcePostId", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const postValuesCalls = mockValues.mock.calls.filter(
        (call) => call[0].sourceMetadata !== undefined
      );

      const backupIds = postValuesCalls.map(
        (call) => call[0].sourceMetadata.backupSourcePostId
      );
      expect(backupIds).toContain("backup-post-001");
      expect(backupIds).toContain("backup-post-002");
    });

    it("sets sourceMetadata.sessionIds = [] on every restored post", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const postValuesCalls = mockValues.mock.calls.filter(
        (call) => call[0].sourceMetadata !== undefined
      );
      for (const call of postValuesCalls) {
        expect(call[0].sourceMetadata.sessionIds).toEqual([]);
      }
    });

    it("sets sourceMetadata.insightIds = [] on every restored post", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const postValuesCalls = mockValues.mock.calls.filter(
        (call) => call[0].sourceMetadata !== undefined
      );
      for (const call of postValuesCalls) {
        expect(call[0].sourceMetadata.insightIds).toEqual([]);
      }
    });
  });

  // ── ID remapping ───────────────────────────────────────────────────────────

  describe("ID remapping", () => {
    it("idMap contains an entry for every backup post ID", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      for (const post of SAMPLE_BUNDLE.posts) {
        expect(summary.idMap).toHaveProperty(post.id);
      }
    });

    it("idMap values are valid UUIDs different from original backup IDs", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

      for (const [oldId, newId] of Object.entries(summary.idMap)) {
        expect(newId).toMatch(uuidPattern);
        expect(newId).not.toBe(oldId);
      }
    });

    it("all new IDs in idMap are unique", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      const newIds = Object.values(summary.idMap);
      const uniqueIds = new Set(newIds);
      expect(uniqueIds.size).toBe(newIds.length);
    });
  });

  // ── Series creation ────────────────────────────────────────────────────────

  describe("series creation", () => {
    it("returns seriesCreated matching the number of series in the bundle", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      expect(summary.seriesCreated).toBe(SAMPLE_BUNDLE.series.length);
    });

    it("returns seriesFailed = 0 when all series inserts succeed", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      expect(summary.seriesFailed).toBe(0);
    });

    it("inserts series with the target workspaceId", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const seriesInsertCall = mockValues.mock.calls.find(
        (call) =>
          call[0].workspaceId === RESTORE_OPTIONS.workspaceId &&
          call[0].slug !== undefined &&
          call[0].title !== undefined &&
          call[0].isPublic !== undefined
      );
      expect(seriesInsertCall).toBeDefined();
      expect(seriesInsertCall![0].title).toBe("TypeScript Mastery");
      expect(seriesInsertCall![0].slug).toBe("typescript-mastery");
    });

    it("preserves series fields: description, coverImage, isPublic", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const seriesValues = mockValues.mock.calls.find(
        (call) => call[0].slug === "typescript-mastery"
      );
      expect(seriesValues![0].description).toBe("Complete guide to TypeScript");
      expect(seriesValues![0].coverImage).toBe("https://example.com/ts-cover.jpg");
      expect(seriesValues![0].isPublic).toBe(true);
    });
  });

  // ── Series posts ───────────────────────────────────────────────────────────

  describe("series_posts creation", () => {
    it("creates series_posts entries for each series post reference", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      expect(summary.seriesPostsCreated).toBe(2);
    });

    it("returns seriesPostsFailed = 0 when all series posts succeed", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      expect(summary.seriesPostsFailed).toBe(0);
    });

    it("inserts series_posts with remapped (new) post IDs, not original backup IDs", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const seriesPostsValues = mockValues.mock.calls.filter(
        (call) => call[0].seriesId !== undefined && call[0].postId !== undefined
      );

      for (const call of seriesPostsValues) {
        // postId should be a new UUID, not the original backup ID
        expect(call[0].postId).not.toBe("backup-post-001");
        expect(call[0].postId).not.toBe("backup-post-002");
        // It should be in the idMap values
        expect(Object.values(summary.idMap)).toContain(call[0].postId);
      }
    });

    it("preserves series post order in series_posts", async () => {
      await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      const seriesPostsValues = mockValues.mock.calls
        .filter(
          (call) => call[0].seriesId !== undefined && call[0].postId !== undefined
        )
        .sort((a, b) => a[0].order - b[0].order);

      expect(seriesPostsValues[0][0].order).toBe(1);
      expect(seriesPostsValues[1][0].order).toBe(2);
    });

    it("skips series_posts when the original post ID was not in the bundle", async () => {
      const bundleWithOrphanedSeriesPost: BackupBundle = {
        ...SAMPLE_BUNDLE,
        series: [
          {
            ...SAMPLE_BUNDLE.series[0],
            posts: [
              { postId: "backup-post-001", order: 1 },
              { postId: "non-existent-post-id", order: 2 },
            ],
          },
        ],
        // Only import post-001, not post-002
        posts: [SAMPLE_BUNDLE.posts[0]],
      };

      const summary = await restoreBackupBundle(
        bundleWithOrphanedSeriesPost,
        RESTORE_OPTIONS
      );

      // 1 series post created (post-001), 1 failed (non-existent)
      expect(summary.seriesPostsCreated).toBe(1);
      expect(summary.seriesPostsFailed).toBe(1);
    });
  });

  // ── Empty bundle ───────────────────────────────────────────────────────────

  describe("empty bundle", () => {
    it("handles empty posts array gracefully", async () => {
      const emptyBundle: BackupBundle = {
        ...SAMPLE_BUNDLE,
        posts: [],
        series: [],
        manifest: { ...SAMPLE_BUNDLE.manifest, postCount: 0, seriesCount: 0 },
      };
      const summary = await restoreBackupBundle(emptyBundle, RESTORE_OPTIONS);

      expect(summary.postsCreated).toBe(0);
      expect(summary.postsFailed).toBe(0);
      expect(summary.seriesCreated).toBe(0);
      expect(summary.idMap).toEqual({});
    });

    it("handles empty series array gracefully", async () => {
      const bundleNoSeries: BackupBundle = {
        ...SAMPLE_BUNDLE,
        series: [],
      };
      const summary = await restoreBackupBundle(bundleNoSeries, RESTORE_OPTIONS);

      expect(summary.seriesCreated).toBe(0);
      expect(summary.seriesPostsCreated).toBe(0);
      expect(summary.postsCreated).toBe(SAMPLE_BUNDLE.posts.length);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("increments postsFailed when a post insert throws", async () => {
      // First call (post insert) throws, second resolves
      mockValues
        .mockRejectedValueOnce(new Error("DB write error"))
        .mockResolvedValue(undefined);

      const singlePostBundle: BackupBundle = {
        ...SAMPLE_BUNDLE,
        posts: [SAMPLE_BUNDLE.posts[0]],
        series: [],
      };
      const summary = await restoreBackupBundle(singlePostBundle, RESTORE_OPTIONS);

      expect(summary.postsFailed).toBe(1);
      expect(summary.postsCreated).toBe(0);
    });

    it("continues processing remaining posts after a single failure", async () => {
      // First post insert fails, second succeeds (but series insert call order matters)
      let callCount = 0;
      mockValues.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("first post failed"));
        return Promise.resolve(undefined);
      });

      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      // First post failed, second succeeded
      expect(summary.postsFailed).toBe(1);
      expect(summary.postsCreated).toBe(1);
    });

    it("increments seriesFailed when a series insert throws", async () => {
      let callCount = 0;
      mockValues.mockImplementation(() => {
        callCount++;
        // Post inserts succeed (calls 1 and 2), series insert (call 3) fails
        if (callCount === 3) return Promise.reject(new Error("series insert failed"));
        return Promise.resolve(undefined);
      });

      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      expect(summary.seriesFailed).toBe(1);
      expect(summary.seriesCreated).toBe(0);
      // Posts still created successfully
      expect(summary.postsCreated).toBe(2);
    });

    it("does not include failed posts in the idMap", async () => {
      mockValues
        .mockRejectedValueOnce(new Error("first post failed"))
        .mockResolvedValue(undefined);

      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      // Only the second post succeeded
      expect(Object.keys(summary.idMap)).toHaveLength(1);
      expect(summary.idMap).not.toHaveProperty("backup-post-001");
      expect(summary.idMap).toHaveProperty("backup-post-002");
    });
  });

  // ── Summary fields ─────────────────────────────────────────────────────────

  describe("summary fields", () => {
    it("returns all required summary fields", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);

      expect(summary).toHaveProperty("postsCreated");
      expect(summary).toHaveProperty("postsSkipped");
      expect(summary).toHaveProperty("postsFailed");
      expect(summary).toHaveProperty("seriesCreated");
      expect(summary).toHaveProperty("seriesSkipped");
      expect(summary).toHaveProperty("seriesFailed");
      expect(summary).toHaveProperty("seriesPostsCreated");
      expect(summary).toHaveProperty("seriesPostsFailed");
      expect(summary).toHaveProperty("idMap");
    });

    it("postsSkipped and seriesSkipped are 0 in the default flow", async () => {
      const summary = await restoreBackupBundle(SAMPLE_BUNDLE, RESTORE_OPTIONS);
      expect(summary.postsSkipped).toBe(0);
      expect(summary.seriesSkipped).toBe(0);
    });
  });
});
