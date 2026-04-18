import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  workspaces,
  twitterIntegrations,
  linkedinIntegrations,
  twitterPublications,
  linkedinPublications,
  socialAnalytics,
} from "@sessionforge/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { verifyQStashRequest } from "@/lib/qstash";
import { getTweetAnalytics } from "@/lib/integrations/twitter";
import { getLinkedInPostAnalytics } from "@/lib/integrations/linkedin";
import { logAndIgnore } from "@/lib/errors";

export const dynamic = "force-dynamic";

type SocialAnalyticsInsert = typeof socialAnalytics.$inferInsert;

export async function POST(request: Request) {
  const rawBody = await request.text();

  const isValid = await verifyQStashRequest(request, rawBody).catch(() => false);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { workspaceId?: string };
  const { workspaceId } = body;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const syncedAt = new Date();
  const start = Date.now();

  let twitterSynced = 0;
  let twitterErrors = 0;
  let linkedinSynced = 0;
  let linkedinErrors = 0;

  // ── Twitter sync ──────────────────────────────────────────────────────────

  const twitterIntegration = await db.query.twitterIntegrations.findFirst({
    where: and(
      eq(twitterIntegrations.workspaceId, workspace.id),
      eq(twitterIntegrations.enabled, true)
    ),
  });

  if (twitterIntegration?.twitterUserId) {
    try {
      const result = await getTweetAnalytics(
        twitterIntegration.accessToken,
        twitterIntegration.twitterUserId,
        { maxResults: 100 }
      );

      const tweetIds = result.tweets.map((t) => t.tweetId);
      const publications = tweetIds.length
        ? await db.query.twitterPublications.findMany({
            where: and(
              eq(twitterPublications.workspaceId, workspace.id),
              inArray(twitterPublications.tweetId, tweetIds),
            ),
          })
        : [];
      const tweetIdToPostId = new Map(
        publications.map((p) => [p.tweetId, p.postId]),
      );

      const rows: SocialAnalyticsInsert[] = [];
      for (const tweet of result.tweets) {
        const postId = tweetIdToPostId.get(tweet.tweetId);
        if (!postId) continue;
        rows.push({
          workspaceId: workspace.id,
          postId,
          platform: "twitter",
          impressions: tweet.impressions,
          likes: tweet.likes,
          shares: tweet.retweets,
          comments: tweet.replies,
          clicks: tweet.clicks,
          rawMetrics: {
            tweetId: tweet.tweetId,
            quotes: tweet.quotes,
            text: tweet.text,
            createdAt: tweet.createdAt,
          },
          syncedAt,
        });
      }

      if (rows.length) {
        try {
          await db
            .insert(socialAnalytics)
            .values(rows)
            .onConflictDoUpdate({
              target: [socialAnalytics.postId, socialAnalytics.platform],
              set: {
                impressions: sql`excluded.impressions`,
                likes: sql`excluded.likes`,
                shares: sql`excluded.shares`,
                comments: sql`excluded.comments`,
                clicks: sql`excluded.clicks`,
                rawMetrics: sql`excluded.raw_metrics`,
                syncedAt: sql`excluded.synced_at`,
                updatedAt: syncedAt,
              },
            });
          twitterSynced += rows.length;
        } catch (err) {
          logAndIgnore("automation.social-sync.twitter.batchUpsert", err, {
            workspaceId: workspace.id,
            rows: rows.length,
          });
          twitterErrors += rows.length;
        }
      }

      await db
        .update(twitterIntegrations)
        .set({ lastSyncAt: syncedAt })
        .where(eq(twitterIntegrations.id, twitterIntegration.id));
    } catch (err) {
      logAndIgnore("automation.social-sync.twitter.fetch", err, {
        workspaceId: workspace.id,
      });
      twitterErrors++;
    }
  }

  // ── LinkedIn sync ─────────────────────────────────────────────────────────

  const linkedinIntegration = await db.query.linkedinIntegrations.findFirst({
    where: and(
      eq(linkedinIntegrations.workspaceId, workspace.id),
      eq(linkedinIntegrations.enabled, true)
    ),
  });

  if (linkedinIntegration?.linkedinUserId) {
    try {
      const result = await getLinkedInPostAnalytics(
        linkedinIntegration.accessToken,
        linkedinIntegration.linkedinUserId,
        { count: 20 }
      );

      const postIds = result.posts.map((p) => p.postId);
      const publications = postIds.length
        ? await db.query.linkedinPublications.findMany({
            where: and(
              eq(linkedinPublications.workspaceId, workspace.id),
              inArray(linkedinPublications.linkedinPostId, postIds),
            ),
          })
        : [];
      const linkedinPostIdToPostId = new Map(
        publications.map((p) => [p.linkedinPostId, p.postId]),
      );

      const rows: SocialAnalyticsInsert[] = [];
      for (const post of result.posts) {
        const postId = linkedinPostIdToPostId.get(post.postId);
        if (!postId) continue;
        rows.push({
          workspaceId: workspace.id,
          postId,
          platform: "linkedin",
          impressions: post.impressions,
          likes: post.likes,
          shares: post.reposts,
          comments: post.comments,
          clicks: post.clicks,
          rawMetrics: {
            linkedinPostId: post.postId,
            text: post.text,
            createdAt: post.createdAt,
          },
          syncedAt,
        });
      }

      if (rows.length) {
        try {
          await db
            .insert(socialAnalytics)
            .values(rows)
            .onConflictDoUpdate({
              target: [socialAnalytics.postId, socialAnalytics.platform],
              set: {
                impressions: sql`excluded.impressions`,
                likes: sql`excluded.likes`,
                shares: sql`excluded.shares`,
                comments: sql`excluded.comments`,
                clicks: sql`excluded.clicks`,
                rawMetrics: sql`excluded.raw_metrics`,
                syncedAt: sql`excluded.synced_at`,
                updatedAt: syncedAt,
              },
            });
          linkedinSynced += rows.length;
        } catch (err) {
          logAndIgnore("automation.social-sync.linkedin.batchUpsert", err, {
            workspaceId: workspace.id,
            rows: rows.length,
          });
          linkedinErrors += rows.length;
        }
      }

      await db
        .update(linkedinIntegrations)
        .set({ lastSyncAt: syncedAt })
        .where(eq(linkedinIntegrations.id, linkedinIntegration.id));
    } catch (err) {
      logAndIgnore("automation.social-sync.linkedin.fetch", err, {
        workspaceId: workspace.id,
      });
      linkedinErrors++;
    }
  }

  return NextResponse.json({
    synced: true,
    workspaceId,
    twitter: { synced: twitterSynced, errors: twitterErrors },
    linkedin: { synced: linkedinSynced, errors: linkedinErrors },
    syncedAt: syncedAt.toISOString(),
    durationMs: Date.now() - start,
  });
}
