import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, wordpressConnections } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { decryptAppPassword } from "@/lib/wordpress/crypto";
import { WordPressClient } from "@/lib/wordpress/client";
import { markdownToHtml } from "@/lib/export";
import { canPublish, getOverridePolicy } from "@/lib/verification/publish-gate";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    // 1. Verify post access via workspace authorization
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { workspace: true },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.PUBLISHING_PUBLISH);

    // Parse and validate request body early (needed for publish-gate override check)
    const body = await req.json().catch(() => ({})) as {
      status?: "draft" | "publish";
      excerpt?: string;
      categories?: number[];
      tags?: number[];
      featuredMediaId?: number;
      overrideRiskFlags?: boolean;
    };

    // Publish-gate check: block if unresolved critical risk flags exist
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

    // 2. Fetch workspace WordPress connection
    const connectionRows = await db
      .select({
        siteUrl: wordpressConnections.siteUrl,
        username: wordpressConnections.username,
        encryptedAppPassword: wordpressConnections.encryptedAppPassword,
      })
      .from(wordpressConnections)
      .where(
        and(
          eq(wordpressConnections.workspaceId, post.workspaceId),
          eq(wordpressConnections.isActive, true)
        )
      )
      .limit(1);

    if (!connectionRows.length) {
      throw new AppError(
        "No WordPress connection configured for this workspace",
        ERROR_CODES.BAD_REQUEST
      );
    }

    const { siteUrl, username, encryptedAppPassword } = connectionRows[0];

    // 3. Decrypt app password
    let appPassword: string;
    try {
      appPassword = decryptAppPassword(encryptedAppPassword);
    } catch {
      throw new AppError("Failed to decrypt stored credentials", ERROR_CODES.INTERNAL_ERROR);
    }

    // Destructure body fields for WordPress
    const {
      status = "draft",
      excerpt,
      categories,
      tags,
      featuredMediaId,
    } = body;

    if (status !== "draft" && status !== "publish") {
      throw new AppError("status must be 'draft' or 'publish'", ERROR_CODES.BAD_REQUEST);
    }

    // 4. Convert post markdown to HTML
    const htmlContent = markdownToHtml(post.markdown);

    // 5. Publish to WordPress
    const client = new WordPressClient(siteUrl, username, appPassword);

    let wpPost: Awaited<ReturnType<typeof client.createPost>>;
    try {
      wpPost = await client.createPost({
        title: post.title,
        htmlContent,
        excerpt: typeof excerpt === "string" ? excerpt : undefined,
        categories: Array.isArray(categories) ? categories : undefined,
        tags: Array.isArray(tags) ? tags : undefined,
        featuredMediaId:
          typeof featuredMediaId === "number" ? featuredMediaId : undefined,
        status,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to publish to WordPress";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // 6. Update posts row with WordPress metadata
    await db
      .update(posts)
      .set({
        wordpressPublishedUrl: wpPost.link,
        wordpressPostId: String(wpPost.id),
      })
      .where(eq(posts.id, id));

    // 7. Return success response
    return NextResponse.json({
      success: true,
      wordpressPostId: wpPost.id,
      wordpressUrl: wpPost.link,
    });
  })(req);
}
