import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { posts, supplementaryContent, contentAssets, postRevisions } from "@sessionforge/db";
import { eq, and, desc, count } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { computeSeoScore } from "@/lib/seo";

export const dynamic = "force-dynamic";

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function supplementaryFilename(contentType: string): string {
  return `${contentType.replace(/_/g, "-")}.md`;
}

// ── Type for SEO metadata ───────────────────────────────────────────────────

interface SeoMetadata {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
}

// ── GET — generate export package ZIP ──────────────────────────────────────

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true, insight: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    if (post.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    // Fetch all associated data in parallel
    const [suppItems, mediaAssets, revisionRows, [{ total: revisionCount }]] = await Promise.all([
      db.query.supplementaryContent.findMany({
        where: and(
          eq(supplementaryContent.postId, id),
          eq(supplementaryContent.workspaceId, post.workspaceId)
        ),
      }),
      db.query.contentAssets.findMany({
        where: and(
          eq(contentAssets.postId, id),
          eq(contentAssets.workspaceId, post.workspaceId)
        ),
      }),
      db.query.postRevisions.findMany({
        where: eq(postRevisions.postId, id),
        orderBy: [desc(postRevisions.createdAt)],
        limit: 50,
      }),
      db
        .select({ total: count() })
        .from(postRevisions)
        .where(eq(postRevisions.postId, id)),
    ]);

    const seoMetadata = (post as unknown as { seoMetadata?: SeoMetadata }).seoMetadata ?? null;

    // Build ZIP
    const zip = new JSZip();

    // 1. Primary markdown
    zip.file("content.md", post.markdown ?? "");

    // 2. Metadata
    const metadata = {
      title: post.title,
      contentType: post.contentType,
      status: post.status ?? "draft",
      wordCount: post.wordCount ?? (post.markdown?.split(/\s+/).filter(Boolean).length ?? 0),
      createdAt: post.createdAt?.toISOString() ?? null,
      updatedAt: post.updatedAt?.toISOString() ?? null,
      insightId: post.insightId,
      generatedBy: (post.sourceMetadata as { generatedBy?: string } | null)?.generatedBy ?? null,
    };
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));

    // 3. Supplementary content
    if (suppItems.length > 0) {
      const suppFolder = zip.folder("supplementary");
      for (const item of suppItems) {
        if (suppFolder) {
          suppFolder.file(
            supplementaryFilename(item.contentType),
            item.content
          );
        }
      }
    }

    // 4. Media assets
    if (mediaAssets.length > 0) {
      const mediaFolder = zip.folder("media");
      for (let i = 0; i < mediaAssets.length; i++) {
        const asset = mediaAssets[i];
        if (!asset || !mediaFolder) continue;
        const diagramType = (asset.metadata as { diagramType?: string } | null)?.diagramType ?? "diagram";
        const filename = `${diagramType}-${i + 1}.mermaid`;
        mediaFolder.file(filename, asset.content);
      }
    }

    // 5. SEO metadata
    const seoFolder = zip.folder("seo");
    if (seoFolder) {
      const seoScore = seoMetadata
        ? computeSeoScore(post.markdown ?? "", post.title, seoMetadata)
        : null;
      const seoExport = {
        metaTitle: seoMetadata?.metaTitle ?? null,
        metaDescription: seoMetadata?.metaDescription ?? null,
        keywords: seoMetadata?.keywords ?? [],
        ogTitle: seoMetadata?.ogTitle ?? null,
        ogDescription: seoMetadata?.ogDescription ?? null,
        score: seoScore?.total ?? null,
      };
      seoFolder.file("metadata.json", JSON.stringify(seoExport, null, 2));
    }

    // 6. Revisions summary
    const revisionsFolder = zip.folder("revisions");
    if (revisionsFolder) {
      const revisionSummary = {
        totalRevisions: revisionCount,
        latestRevisionDate: revisionRows[0]?.createdAt?.toISOString() ?? null,
        revisions: revisionRows.map((rev) => ({
          id: rev.id,
          versionType: rev.versionType,
          editType: rev.editType,
          wordCount: rev.wordCount,
          wordCountDelta: rev.wordCountDelta,
          createdAt: rev.createdAt?.toISOString() ?? null,
          createdBy: rev.createdBy,
        })),
      };
      revisionsFolder.file("summary.json", JSON.stringify(revisionSummary, null, 2));
    }

    // 7. Manifest
    const manifest = {
      exportedAt: new Date().toISOString(),
      postId: id,
      title: post.title,
      counts: {
        primaryContent: 1,
        supplementary: suppItems.length,
        media: mediaAssets.length,
        revisions: revisionCount,
        seoFields: seoMetadata
          ? Object.values(seoMetadata).filter((v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)).length
          : 0,
      },
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const filename = `${slugify(post.title) || "export"}-package.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  })(request);
}
