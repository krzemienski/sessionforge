import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { posts, series, seriesPosts, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import {
  buildBackupBundle,
  type BackupablePost,
  type BackupSeries,
  type WorkspaceMetadata,
} from "@/lib/backup/backup-bundle";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const body = await req.json();
    const { workspaceSlug } = body as { workspaceSlug?: string };

    if (!workspaceSlug) {
      throw new AppError("workspaceSlug is required", ERROR_CODES.BAD_REQUEST);
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const workspaceMeta: WorkspaceMetadata = {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    };

    const postResults = await db.query.posts.findMany({
      where: eq(posts.workspaceId, workspace.id),
    });

    const backupablePosts: BackupablePost[] = postResults.map((post) => ({
      id: post.id,
      title: post.title,
      markdown: post.markdown ?? "",
      contentType: post.contentType,
      status: post.status ?? null,
      keywords: (post.keywords as string[] | null) ?? null,
      citations: (post.citations as BackupablePost["citations"]) ?? null,
      seoMetadata: (post.seoMetadata as BackupablePost["seoMetadata"]) ?? null,
      hashnodeUrl: post.hashnodeUrl ?? null,
      wordpressPublishedUrl: post.wordpressPublishedUrl ?? null,
      publishedAt: post.publishedAt ?? null,
      createdAt: post.createdAt ?? null,
      updatedAt: post.updatedAt ?? null,
    }));

    const seriesResults = await db.query.series.findMany({
      where: eq(series.workspaceId, workspace.id),
      with: {
        seriesPosts: true,
      },
    });

    const backupSeries: BackupSeries[] = seriesResults.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description ?? null,
      slug: s.slug,
      coverImage: s.coverImage ?? null,
      isPublic: s.isPublic ?? null,
      posts: s.seriesPosts.map((sp) => ({
        postId: sp.postId,
        order: sp.order,
      })),
      createdAt: s.createdAt ?? null,
      updatedAt: s.updatedAt ?? null,
    }));

    const zipBuffer = await buildBackupBundle(backupablePosts, backupSeries, workspaceMeta);

    const filename = `sessionforge-backup-${workspace.slug}-${new Date().toISOString().slice(0, 10)}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
        "X-Backup-Post-Count": String(backupablePosts.length),
        "X-Backup-Series-Count": String(backupSeries.length),
      },
    });
  })(req);
}
