import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { socialAnalytics, workspaces } from "@sessionforge/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function parseTimeframeDays(timeframe: string): number {
  const match = timeframe.match(/^(\d+)d$/);
  if (match) return parseInt(match[1], 10);
  if (timeframe === "7d") return 7;
  if (timeframe === "90d") return 90;
  return 30;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const timeframe = searchParams.get("timeframe") ?? "30d";
  const platform = searchParams.get("platform");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.ANALYTICS_READ
  );

  const days = parseTimeframeDays(timeframe);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const conditions = [
    eq(socialAnalytics.workspaceId, workspace.id),
    gte(socialAnalytics.syncedAt, since),
  ];

  if (platform === "twitter" || platform === "linkedin") {
    conditions.push(eq(socialAnalytics.platform, platform));
  }

  const rows = await db.query.socialAnalytics.findMany({
    where: and(...conditions),
  });

  const totals = rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + (row.impressions ?? 0),
      likes: acc.likes + (row.likes ?? 0),
      shares: acc.shares + (row.shares ?? 0),
      comments: acc.comments + (row.comments ?? 0),
      clicks: acc.clicks + (row.clicks ?? 0),
    }),
    { impressions: 0, likes: 0, shares: 0, comments: 0, clicks: 0 }
  );

  const byPlatform: Record<string, typeof totals> = {};
  for (const row of rows) {
    const p = row.platform;
    if (!byPlatform[p]) {
      byPlatform[p] = { impressions: 0, likes: 0, shares: 0, comments: 0, clicks: 0 };
    }
    byPlatform[p].impressions += row.impressions ?? 0;
    byPlatform[p].likes += row.likes ?? 0;
    byPlatform[p].shares += row.shares ?? 0;
    byPlatform[p].comments += row.comments ?? 0;
    byPlatform[p].clicks += row.clicks ?? 0;
  }

  return NextResponse.json({
    timeframe,
    since: since.toISOString(),
    totals,
    byPlatform,
    posts: rows,
  });
}
