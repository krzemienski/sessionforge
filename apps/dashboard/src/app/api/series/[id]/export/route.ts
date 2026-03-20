import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { series, seriesPosts } from "@sessionforge/db";
import { eq, asc } from "drizzle-orm";
import { buildStaticSiteZip, staticSiteDownloadHeaders } from "@/lib/export/static-site-builder";
import type { ExportablePost } from "@/lib/export/markdown-export";
import type { ThemeId } from "@/lib/export/theme-manager";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_THEMES: ThemeId[] = ["minimal-portfolio", "technical-blog", "changelog"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const seriesItem = await db.query.series.findFirst({
    where: eq(series.id, id),
  });

  if (!seriesItem) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  await getAuthorizedWorkspaceById(
    session,
    seriesItem.workspaceId,
    PERMISSIONS.CONTENT_READ
  );

  const { searchParams } = new URL(request.url);
  const themeParam = searchParams.get("theme") ?? "technical-blog";
  const themeId: ThemeId = VALID_THEMES.includes(themeParam as ThemeId)
    ? (themeParam as ThemeId)
    : "technical-blog";

  const seriesPostRows = await db.query.seriesPosts.findMany({
    where: eq(seriesPosts.seriesId, id),
    orderBy: [asc(seriesPosts.order)],
    with: {
      post: {
        with: {
          insight: {
            with: {
              session: true,
            },
          },
        },
      },
    },
  });

  const exportablePosts: ExportablePost[] = seriesPostRows
    .filter((sp) => sp.post !== null)
    .map((sp) => {
      const post = sp.post;
      return {
        id: post.id,
        title: post.title,
        markdown: post.markdown,
        contentType: post.contentType,
        status: post.status,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        platformFooterEnabled: post.platformFooterEnabled ?? false,
        durationMinutes: post.insight?.session?.durationSeconds
          ? Math.round(post.insight.session.durationSeconds / 60)
          : null,
      };
    });

  try {
    const zipBuffer = await buildStaticSiteZip(exportablePosts, {
      themeId,
      collectionName: seriesItem.title,
      collectionDescription: seriesItem.description ?? undefined,
    });

    const { contentType, filename } = staticSiteDownloadHeaders(seriesItem.title);

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
        "X-Export-Count": String(exportablePosts.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
