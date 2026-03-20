/**
 * Restore engine for backup bundles.
 * Reads a validated BackupBundle and imports posts, series, and series_posts
 * into a target workspace with ID remapping to avoid UUID collisions.
 * Sets sourceMetadata.generatedBy='manual' and stores original backup post IDs
 * for source linkage traceability.
 */

import { db } from "@/lib/db";
import {
  posts,
  series as seriesTable,
  seriesPosts as seriesPostsTable,
} from "@sessionforge/db";
import type { BackupBundle, BackupablePost, BackupSeries } from "./backup-bundle";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RestoreOptions {
  workspaceId: string;
}

export interface RestoreSummary {
  postsCreated: number;
  postsSkipped: number;
  postsFailed: number;
  seriesCreated: number;
  seriesSkipped: number;
  seriesFailed: number;
  seriesPostsCreated: number;
  seriesPostsFailed: number;
  /** Maps original backup post IDs to newly created workspace post IDs */
  idMap: Record<string, string>;
}

/**
 * Extended source metadata stored on each restored post.
 * Extends the standard sourceMetadata shape with a backupSourcePostId field
 * to preserve the original post's ID from the backup bundle.
 */
interface RestoreSourceMetadata {
  sessionIds: string[];
  insightIds: string[];
  generatedBy: "manual";
  backupSourcePostId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Inserts a single post from a backup bundle into the target workspace.
 * Generates a new UUID and stores the original backup post ID in sourceMetadata.
 *
 * @param post - The post data from the backup bundle.
 * @param workspaceId - The target workspace to import into.
 * @returns The newly generated post ID.
 */
async function importPost(
  post: BackupablePost,
  workspaceId: string
): Promise<string> {
  const newId = crypto.randomUUID();

  const sourceMetadata: RestoreSourceMetadata = {
    sessionIds: [],
    insightIds: [],
    generatedBy: "manual",
    backupSourcePostId: post.id,
  };

  await db.insert(posts).values({
    id: newId,
    workspaceId,
    title: post.title,
    // content mirrors markdown for backup-restored posts
    content: post.markdown,
    markdown: post.markdown,
    contentType: post.contentType,
    status: post.status ?? "draft",
    // Cast to any to allow the backupSourcePostId extension beyond the base type
    sourceMetadata: sourceMetadata as unknown as (typeof posts.$inferInsert)["sourceMetadata"],
    keywords: post.keywords ?? [],
    citations: post.citations ?? [],
    seoMetadata: post.seoMetadata,
    hashnodeUrl: post.hashnodeUrl ?? null,
    wordpressPublishedUrl: post.wordpressPublishedUrl ?? null,
    publishedAt: post.publishedAt ?? null,
  });

  return newId;
}

/**
 * Inserts a series and its post memberships into the target workspace.
 * Uses the provided idMap to translate old backup post IDs to new workspace IDs.
 * Series posts that reference an unmapped ID are counted as failed and skipped.
 *
 * @param s - The series data from the backup bundle.
 * @param workspaceId - The target workspace to import into.
 * @param idMap - Mapping of original backup post IDs to new workspace post IDs.
 * @returns Counts of created and failed series_posts entries.
 */
async function importSeries(
  s: BackupSeries,
  workspaceId: string,
  idMap: Record<string, string>
): Promise<{ postsCreated: number; postsFailed: number }> {
  const newSeriesId = crypto.randomUUID();

  await db.insert(seriesTable).values({
    id: newSeriesId,
    workspaceId,
    title: s.title,
    description: s.description ?? null,
    slug: s.slug,
    coverImage: s.coverImage ?? null,
    isPublic: s.isPublic ?? false,
  });

  let postsCreated = 0;
  let postsFailed = 0;

  for (const sp of s.posts) {
    const newPostId = idMap[sp.postId];
    if (!newPostId) {
      postsFailed++;
      continue;
    }

    try {
      await db.insert(seriesPostsTable).values({
        id: crypto.randomUUID(),
        seriesId: newSeriesId,
        postId: newPostId,
        order: sp.order,
      });
      postsCreated++;
    } catch {
      postsFailed++;
    }
  }

  return { postsCreated, postsFailed };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Restores a validated backup bundle into a target workspace.
 *
 * For each post in the bundle:
 *   - Generates a fresh UUID (avoids collisions with existing records)
 *   - Sets sourceMetadata.generatedBy = 'manual'
 *   - Records the original backup post ID in sourceMetadata.backupSourcePostId
 *
 * For each series in the bundle:
 *   - Generates a fresh series UUID
 *   - Remaps series_posts entries using the post ID map
 *   - Skips series_posts referencing posts that failed to import
 *
 * @param bundle - A validated BackupBundle object.
 * @param options - Restore options including the target workspaceId.
 * @returns A RestoreSummary with counts of created/skipped/failed items and the ID map.
 */
export async function restoreBackupBundle(
  bundle: BackupBundle,
  options: RestoreOptions
): Promise<RestoreSummary> {
  const { workspaceId } = options;

  const idMap: Record<string, string> = {};
  let postsCreated = 0;
  let postsSkipped = 0;
  let postsFailed = 0;
  let seriesCreated = 0;
  let seriesSkipped = 0;
  let seriesFailed = 0;
  let seriesPostsCreated = 0;
  let seriesPostsFailed = 0;

  // ── Import posts ──────────────────────────────────────────────────────────────

  for (const post of bundle.posts) {
    try {
      const newId = await importPost(post, workspaceId);
      idMap[post.id] = newId;
      postsCreated++;
    } catch {
      postsFailed++;
    }
  }

  // ── Import series ──────────────────────────────────────────────────────────────

  for (const s of bundle.series) {
    try {
      const { postsCreated: spCreated, postsFailed: spFailed } =
        await importSeries(s, workspaceId, idMap);
      seriesCreated++;
      seriesPostsCreated += spCreated;
      seriesPostsFailed += spFailed;
    } catch {
      seriesFailed++;
    }
  }

  return {
    postsCreated,
    postsSkipped,
    postsFailed,
    seriesCreated,
    seriesSkipped,
    seriesFailed,
    seriesPostsCreated,
    seriesPostsFailed,
    idMap,
  };
}
