import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import type { insightCategoryEnum } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";

type InsightCategory = (typeof insightCategoryEnum.enumValues)[number];

/**
 * Safe, anonymized attribution data derived from a post's linked insight and
 * coding session. Never exposes file paths, raw code, or session content.
 */
export interface AttributionData {
  /** The date and time the coding session started */
  sessionDate: Date;
  /** Approximate session duration, rounded to whole minutes */
  durationMinutes: number;
  /** Claude tool names used during the session (e.g. "Bash", "Edit") */
  toolsUsed: string[];
  /** Number of files modified — count only, no paths exposed */
  filesModifiedCount: number;
  /** Insight composite quality score (0–10 scale) */
  insightScore: number;
  /** Insight category that best describes the coding work */
  insightCategory: InsightCategory;
  /** Human-readable project name derived from the session's working directory */
  projectName: string;
}

/**
 * Loads a post's linked insight and session, then returns a safe AttributionData
 * object suitable for display to readers. Returns null when the post has no
 * linked insight or session.
 *
 * @param postId      The post to look up attribution for
 * @param workspaceId Optional — when provided the post must belong to this workspace
 */
export async function getPostAttribution(
  postId: string,
  workspaceId?: string
): Promise<AttributionData | null> {
  const whereClause = workspaceId
    ? and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId))
    : eq(posts.id, postId);

  const post = await db.query.posts.findFirst({
    where: whereClause,
    with: {
      insight: {
        with: {
          session: true,
        },
      },
    },
  });

  if (!post) return null;

  const { insight } = post;
  if (!insight) return null;

  const { session } = insight;
  if (!session) return null;

  const durationMinutes = session.durationSeconds
    ? Math.round(session.durationSeconds / 60)
    : 0;

  return {
    sessionDate: session.startedAt,
    durationMinutes,
    toolsUsed: session.toolsUsed ?? [],
    filesModifiedCount: session.filesModified?.length ?? 0,
    insightScore: insight.compositeScore,
    insightCategory: insight.category,
    projectName: session.projectName,
  };
}
