import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  workspaces,
  twitterIntegrations,
  linkedinIntegrations,
  twitterPublications,
  linkedinPublications,
  socialAnalytics,
} from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { getTweetAnalytics } from "@/lib/integrations/twitter";
import { getLinkedInPostAnalytics } from "@/lib/integrations/linkedin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workspaceSlug: string | undefined = body.workspaceSlug;

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspaceSlug is required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
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

      for (const tweet of result.tweets) {
        try {
          const publication = await db.query.twitterPublications.findFirst({
            where: and(
              eq(twitterPublications.workspaceId, workspace.id),
              eq(twitterPublications.tweetId, tweet.tweetId)
            ),
          });

          if (!publication) continue;

          await db
            .insert(socialAnalytics)
            .values({
              workspaceId: workspace.id,
              postId: publication.postId,
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
            })
            .onConflictDoUpdate({
              target: [socialAnalytics.postId, socialAnalytics.platform],
              set: {
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
                updatedAt: syncedAt,
              },
            });

          twitterSynced++;
        } catch {
          twitterErrors++;
        }
      }

      await db
        .update(twitterIntegrations)
        .set({ lastSyncAt: syncedAt })
        .where(eq(twitterIntegrations.id, twitterIntegration.id));
    } catch {
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

      for (const post of result.posts) {
        try {
          const publication = await db.query.linkedinPublications.findFirst({
            where: and(
              eq(linkedinPublications.workspaceId, workspace.id),
              eq(linkedinPublications.linkedinPostId, post.postId)
            ),
          });

          if (!publication) continue;

          await db
            .insert(socialAnalytics)
            .values({
              workspaceId: workspace.id,
              postId: publication.postId,
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
            })
            .onConflictDoUpdate({
              target: [socialAnalytics.postId, socialAnalytics.platform],
              set: {
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
                updatedAt: syncedAt,
              },
            });

          linkedinSynced++;
        } catch {
          linkedinErrors++;
        }
      }

      await db
        .update(linkedinIntegrations)
        .set({ lastSyncAt: syncedAt })
        .where(eq(linkedinIntegrations.id, linkedinIntegration.id));
    } catch {
      linkedinErrors++;
    }
  }

  return NextResponse.json({
    twitter: { synced: twitterSynced, errors: twitterErrors },
    linkedin: { synced: linkedinSynced, errors: linkedinErrors },
    syncedAt: syncedAt.toISOString(),
    durationMs: Date.now() - start,
  });
}
