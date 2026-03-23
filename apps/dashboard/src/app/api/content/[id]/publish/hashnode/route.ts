import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, integrationSettings } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { publishToHashnode } from "@/lib/publishing/hashnode";
import { canPublish, getOverridePolicy } from "@/lib/verification/publish-gate";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { wrapInScriptTag } from "@/lib/seo/structured-data-generator";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    // Load post with workspace to verify access
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.PUBLISHING_PUBLISH);

    // Publish-gate check: block if unresolved critical risk flags exist
    const body = await request.json().catch(() => ({})) as {
      tags?: string[];
      subtitle?: string;
      coverImageUrl?: string;
      seoTitle?: string;
      seoDescription?: string;
      canonicalUrl?: string;
      overrideRiskFlags?: boolean;
    };

    const flags = post.riskFlags ?? [];
    const gateResult = canPublish(flags);

    if (!gateResult.allowed) {
      if (!body.overrideRiskFlags) {
        return NextResponse.json(
          {
            error: "unresolved_critical_flags",
            flags: gateResult.blockingFlags,
            requiresOverride: true,
          },
          { status: 409 }
        );
      }

      const overridePolicy = getOverridePolicy("owner");
      if (!overridePolicy.canOverride) {
        throw new AppError("Insufficient permissions to override risk flags", ERROR_CODES.FORBIDDEN);
      }
    }

    if (!post.markdown || !post.title) {
      throw new AppError(
        "Post must have a title and content before publishing",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Load integration settings for the workspace
    const integrationRows = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.workspaceId, post.workspaceId))
      .limit(1);

    const integration = integrationRows[0] ?? null;

    if (!integration?.hashnodeApiToken) {
      throw new AppError(
        "Hashnode API token not configured. Go to Settings > Integrations to connect your Hashnode account.",
        ERROR_CODES.BAD_REQUEST
      );
    }

    if (!integration.hashnodePublicationId) {
      throw new AppError(
        "Hashnode publication ID not configured. Go to Settings > Integrations to set your publication.",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Transform string[] tags to { slug, name }[] format
    const tags = body.tags?.map((tag) => ({
      slug: tag.toLowerCase().trim().replace(/\s+/g, "-"),
      name: tag.trim(),
    }));

    // Use provided canonicalUrl, or fall back to default canonical domain if configured
    let canonicalUrl = body.canonicalUrl;
    if (!canonicalUrl && integration.hashnodeDefaultCanonicalDomain) {
      const domain = integration.hashnodeDefaultCanonicalDomain.replace(/\/$/, "");
      const slug = post.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      canonicalUrl = `${domain}/${slug}`;
    }

    try {
      const result = await publishToHashnode({
        token: integration.hashnodeApiToken,
        publicationId: integration.hashnodePublicationId,
        title: post.title,
        subtitle: body.subtitle,
        contentMarkdown: post.structuredData
          ? `${post.markdown}\n\n${wrapInScriptTag(JSON.stringify(post.structuredData, null, 2))}`
          : post.markdown,
        tags,
        coverImageUrl: body.coverImageUrl,
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
        canonicalUrl,
      });

      // Store the published URL back on the post
      await db
        .update(posts)
        .set({ hashnodeUrl: result.url })
        .where(eq(posts.id, id));

      return NextResponse.json({ url: result.url, articleId: result.articleId });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to publish to Hashnode" },
        { status: 502 }
      );
    }
  })(request);
}
