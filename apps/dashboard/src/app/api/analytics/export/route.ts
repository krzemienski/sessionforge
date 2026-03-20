import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { posts, workspaces } from "@sessionforge/db";
import { eq, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsvValue).join(",");
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const timeframe = searchParams.get("timeframe") ?? "30d";

  if (!workspaceSlug) {
    return new Response("workspace query param required", { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return new Response("Workspace not found", { status: 404 });
  }

  try {
    // Determine date range
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (fromParam) {
      fromDate = new Date(fromParam);
    } else {
      const match = timeframe.match(/^(\d+)d$/);
      const days = match ? parseInt(match[1], 10) : 30;
      fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    if (toParam) {
      toDate = new Date(toParam);
    }

    const whereClause = fromDate
      ? and(eq(posts.workspaceId, workspace.id), gte(posts.createdAt, fromDate))
      : eq(posts.workspaceId, workspace.id);

    const workspacePosts = await db.query.posts.findMany({
      where: whereClause,
      with: {
        socialAnalytics: true,
        performanceMetrics: true,
      },
    });

    const rows: string[] = [];

    // Header row — matches attribution dashboard columns
    rows.push(
      toCsvRow([
        "postId",
        "postTitle",
        "contentType",
        "publishedAt",
        "sourceSessionCount",
        "channels",
        "impressions",
        "clicks",
        "views",
        "engagementRate",
      ])
    );

    for (const post of workspacePosts) {
      // Filter metrics by date range if toDate provided
      const filteredAnalytics = post.socialAnalytics.filter((sa) => {
        if (toDate && sa.syncedAt && sa.syncedAt > toDate) return false;
        return true;
      });

      // Aggregate across all channels
      const totalImpressions = filteredAnalytics.reduce((s, sa) => s + (sa.impressions ?? 0), 0);
      const totalClicks = filteredAnalytics.reduce((s, sa) => s + (sa.clicks ?? 0), 0);
      const totalLikes = filteredAnalytics.reduce((s, sa) => s + (sa.likes ?? 0), 0);
      const totalShares = filteredAnalytics.reduce((s, sa) => s + (sa.shares ?? 0), 0);
      const totalComments = filteredAnalytics.reduce((s, sa) => s + (sa.comments ?? 0), 0);

      const engagementRate =
        totalImpressions > 0
          ? (totalLikes + totalShares + totalComments) / totalImpressions
          : 0;

      // Views from performance metrics
      const totalViews = post.performanceMetrics.reduce((s, m) => s + m.views, 0);

      // Unique channels from social analytics
      const channels = Array.from(new Set(filteredAnalytics.map((sa) => sa.platform))).join("|");

      // Source sessions from post metadata
      const sourceSessionCount = (post.sourceMetadata?.sessionIds ?? []).length;

      rows.push(
        toCsvRow([
          post.id,
          post.title,
          post.contentType,
          post.publishedAt ? post.publishedAt.toISOString() : "",
          sourceSessionCount,
          channels,
          totalImpressions,
          totalClicks,
          totalViews,
          parseFloat((engagementRate * 100).toFixed(4)),
        ])
      );
    }

    const csv = rows.join("\n");
    const filename = `roi-${workspaceSlug}-${fromParam ?? timeframe}-to-${toParam ?? "now"}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Failed to export analytics",
      { status: 500 }
    );
  }
}
