import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { posts, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";

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
    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : undefined;

    const workspacePosts = await db.query.posts.findMany({
      where: eq(posts.workspaceId, workspace.id),
      with: {
        performanceMetrics: true,
        insight: true,
      },
    });

    const rows: string[] = [];

    // Header row
    rows.push(
      toCsvRow([
        "post_id",
        "title",
        "content_type",
        "status",
        "tone",
        "word_count",
        "insight_category",
        "insight_composite_score",
        "metric_recorded_at",
        "views",
        "likes",
        "comments",
        "shares",
        "engagement_rate",
      ])
    );

    for (const post of workspacePosts) {
      const filteredMetrics = post.performanceMetrics.filter((m) => {
        if (fromDate && m.recordedAt && m.recordedAt < fromDate) return false;
        if (toDate && m.recordedAt && m.recordedAt > toDate) return false;
        return true;
      });

      if (filteredMetrics.length === 0) {
        // Include post with no metrics in range as a single row with empty metric columns
        rows.push(
          toCsvRow([
            post.id,
            post.title,
            post.contentType,
            post.status,
            post.toneUsed ?? "",
            post.wordCount ?? 0,
            post.insight?.category ?? "",
            post.insight?.compositeScore ?? "",
            "",
            0,
            0,
            0,
            0,
            0,
          ])
        );
      } else {
        for (const m of filteredMetrics) {
          rows.push(
            toCsvRow([
              post.id,
              post.title,
              post.contentType,
              post.status,
              post.toneUsed ?? "",
              post.wordCount ?? 0,
              post.insight?.category ?? "",
              post.insight?.compositeScore ?? "",
              m.recordedAt ? m.recordedAt.toISOString() : "",
              m.views,
              m.likes,
              m.comments,
              m.shares,
              m.engagementRate,
            ])
          );
        }
      }
    }

    const csv = rows.join("\n");
    const filename = `analytics-${workspaceSlug}-${fromParam ?? "all"}-to-${toParam ?? "all"}.csv`;

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
