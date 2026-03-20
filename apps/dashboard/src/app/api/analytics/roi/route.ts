import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { socialAnalytics, posts, workspaces } from "@sessionforge/db";
import { eq, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

function parseTimeframeDays(timeframe: string): number {
  const match = timeframe.match(/^(\d+)d$/);
  if (match) return parseInt(match[1], 10);
  if (timeframe === "7d") return 7;
  if (timeframe === "90d") return 90;
  return 30;
}

function aggregateChannelMetrics(rows: typeof socialAnalytics.$inferSelect[]) {
  return rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + (row.impressions ?? 0),
      clicks: acc.clicks + (row.clicks ?? 0),
      likes: acc.likes + (row.likes ?? 0),
      shares: acc.shares + (row.shares ?? 0),
      comments: acc.comments + (row.comments ?? 0),
    }),
    { impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0 }
  );
}

function computeEngagementRate(metrics: {
  impressions: number;
  likes: number;
  shares: number;
  comments: number;
}): number {
  if (metrics.impressions === 0) return 0;
  return (metrics.likes + metrics.shares + metrics.comments) / metrics.impressions;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const timeframe = searchParams.get("timeframe") ?? "30d";

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const days = parseTimeframeDays(timeframe);
  const now = Date.now();
  const currentStart = new Date(now - days * 24 * 60 * 60 * 1000);
  const priorStart = new Date(now - 2 * days * 24 * 60 * 60 * 1000);

  // Fetch current period analytics
  const currentRows = await db.query.socialAnalytics.findMany({
    where: and(
      eq(socialAnalytics.workspaceId, workspace.id),
      gte(socialAnalytics.syncedAt, currentStart)
    ),
  });

  // Fetch prior period analytics (one full period before current)
  const priorRows = await db.query.socialAnalytics.findMany({
    where: and(
      eq(socialAnalytics.workspaceId, workspace.id),
      gte(socialAnalytics.syncedAt, priorStart)
    ),
  });

  // Filter prior rows to only the prior period (not overlapping with current)
  const priorOnlyRows = priorRows.filter(
    (row) => row.syncedAt && row.syncedAt < currentStart
  );

  // Current period: count published posts
  const currentPublishedPosts = await db.query.posts.findMany({
    where: and(
      eq(posts.workspaceId, workspace.id),
      gte(posts.publishedAt, currentStart)
    ),
  });

  const priorPublishedPosts = await db.query.posts.findMany({
    where: and(
      eq(posts.workspaceId, workspace.id),
      gte(posts.publishedAt, priorStart)
    ),
  });

  const priorOnlyPublishedPosts = priorPublishedPosts.filter(
    (p) => p.publishedAt && p.publishedAt < currentStart
  );

  // Aggregate totals for current and prior periods
  const currentTotals = aggregateChannelMetrics(currentRows);
  const priorTotals = aggregateChannelMetrics(priorOnlyRows);

  const currentEngagementRate = computeEngagementRate(currentTotals);
  const priorEngagementRate = computeEngagementRate(priorTotals);

  function delta(current: number, prior: number): number | null {
    if (prior === 0) return null;
    return (current - prior) / prior;
  }

  const totals = {
    current: {
      impressions: currentTotals.impressions,
      clicks: currentTotals.clicks,
      engagementRate: currentEngagementRate,
      publishCount: currentPublishedPosts.length,
    },
    prior: {
      impressions: priorTotals.impressions,
      clicks: priorTotals.clicks,
      engagementRate: priorEngagementRate,
      publishCount: priorOnlyPublishedPosts.length,
    },
    deltas: {
      impressions: delta(currentTotals.impressions, priorTotals.impressions),
      clicks: delta(currentTotals.clicks, priorTotals.clicks),
      engagementRate: delta(currentEngagementRate, priorEngagementRate),
      publishCount: delta(currentPublishedPosts.length, priorOnlyPublishedPosts.length),
    },
  };

  // Aggregate by channel/platform
  const platforms = Array.from(new Set([
    ...currentRows.map((r) => r.platform),
    ...priorOnlyRows.map((r) => r.platform),
  ]));

  const byChannel = platforms.map((platform) => {
    const curr = currentRows.filter((r) => r.platform === platform);
    const prior = priorOnlyRows.filter((r) => r.platform === platform);

    const currPosts = currentPublishedPosts.filter((p) =>
      curr.some((r) => r.postId === p.id)
    );
    const priorPosts = priorOnlyPublishedPosts.filter((p) =>
      prior.some((r) => r.postId === p.id)
    );

    const currAgg = aggregateChannelMetrics(curr);
    const priorAgg = aggregateChannelMetrics(prior);
    const currEngagement = computeEngagementRate(currAgg);
    const priorEngagement = computeEngagementRate(priorAgg);

    return {
      platform,
      current: {
        impressions: currAgg.impressions,
        clicks: currAgg.clicks,
        engagementRate: currEngagement,
        publishCount: currPosts.length,
      },
      prior: {
        impressions: priorAgg.impressions,
        clicks: priorAgg.clicks,
        engagementRate: priorEngagement,
        publishCount: priorPosts.length,
      },
      deltas: {
        impressions: delta(currAgg.impressions, priorAgg.impressions),
        clicks: delta(currAgg.clicks, priorAgg.clicks),
        engagementRate: delta(currEngagement, priorEngagement),
        publishCount: delta(currPosts.length, priorPosts.length),
      },
    };
  });

  return NextResponse.json({
    timeframe,
    currentPeriod: {
      from: currentStart.toISOString(),
      to: new Date(now).toISOString(),
    },
    priorPeriod: {
      from: priorStart.toISOString(),
      to: currentStart.toISOString(),
    },
    totals,
    byChannel,
  });
}
