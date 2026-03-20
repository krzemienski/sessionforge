import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, devtoIntegrations, devtoPublications } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import {
  publishToDevto,
  updateDevtoArticle,
  DevtoApiError,
} from "@/lib/integrations/devto";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, devtoPublishSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { canPublish, getOverridePolicy } from "@/lib/verification/publish-gate";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId)
      throw new AppError("postId query param required", ERROR_CODES.BAD_REQUEST);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!post) throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);

    await getAuthorizedWorkspaceById(
      session,
      post.workspaceId,
      PERMISSIONS.INTEGRATIONS_READ
    );

    const publication = await db.query.devtoPublications.findFirst({
      where: eq(devtoPublications.postId, postId),
    });

    if (!publication) {
      return NextResponse.json({ published: false });
    }

    return NextResponse.json({
      published: true,
      devtoArticleId: publication.devtoArticleId,
      devtoUrl: publication.devtoUrl,
      publishedAsDraft: publication.publishedAsDraft,
      syncedAt: publication.syncedAt,
    });
  })(request);
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await request.json().catch(() => ({}));
    const { postId, workspaceSlug, published, tags, canonicalUrl, series } =
      parseBody(devtoPublishSchema, rawBody);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: { workspace: true },
    });

    if (!post) throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);

    if (post.workspace.slug !== workspaceSlug) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    await getAuthorizedWorkspaceById(
      session,
      post.workspaceId,
      PERMISSIONS.PUBLISHING_PUBLISH
    );

    // Publish-gate check: block if unresolved critical risk flags exist
    const postFlags = post.riskFlags ?? [];
    const gateResult = canPublish(postFlags);

    if (!gateResult.allowed) {
      if (!rawBody.overrideRiskFlags) {
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

    const integration = await db.query.devtoIntegrations.findFirst({
      where: and(
        eq(devtoIntegrations.workspaceId, post.workspaceId),
        eq(devtoIntegrations.enabled, true)
      ),
    });

    if (!integration)
      throw new AppError(
        "Dev.to integration not configured or disabled",
        ERROR_CODES.BAD_REQUEST
      );

    const existing = await db.query.devtoPublications.findFirst({
      where: eq(devtoPublications.postId, postId),
    });

    if (existing)
      throw new AppError(
        "Post already published to Dev.to. Use PUT to update.",
        ERROR_CODES.BAD_REQUEST,
        409
      );

    let result: Awaited<ReturnType<typeof publishToDevto>>;
    try {
      result = await publishToDevto(integration.apiKey, {
        title: post.title,
        body_markdown: post.markdown,
        published: published ?? false,
        tags: tags ?? [],
        canonical_url: canonicalUrl,
        series,
      });
    } catch (err) {
      if (err instanceof DevtoApiError) {
        throw new AppError(
          err.message,
          ERROR_CODES.BAD_REQUEST,
          err.status === 401 ? 400 : err.status,
          { devtoCode: err.code }
        );
      }
      throw err;
    }

    await db.insert(devtoPublications).values({
      workspaceId: post.workspaceId,
      postId,
      integrationId: integration.id,
      devtoArticleId: result.id,
      devtoUrl: result.url,
      publishedAsDraft: !result.published,
      syncedAt: new Date(),
    });

    if (result.published) {
      await db
        .update(posts)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(posts.id, postId));
    }

    return NextResponse.json(
      {
        devtoArticleId: result.id,
        devtoUrl: result.url,
        published: result.published,
      },
      { status: 201 }
    );
  })(request);
}

export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await request.json().catch(() => ({}));
    const { postId, workspaceSlug, published, tags, canonicalUrl, series } =
      parseBody(devtoPublishSchema, rawBody);

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: { workspace: true },
    });

    if (!post) throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);

    if (post.workspace.slug !== workspaceSlug) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    await getAuthorizedWorkspaceById(
      session,
      post.workspaceId,
      PERMISSIONS.PUBLISHING_PUBLISH
    );

    // Publish-gate check: block if unresolved critical risk flags exist
    const putFlags = post.riskFlags ?? [];
    const putGateResult = canPublish(putFlags);

    if (!putGateResult.allowed) {
      if (!rawBody.overrideRiskFlags) {
        return NextResponse.json(
          {
            error: "unresolved_critical_flags",
            flags: putGateResult.blockingFlags,
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

    const publication = await db.query.devtoPublications.findFirst({
      where: eq(devtoPublications.postId, postId),
      with: { integration: true },
    });

    if (!publication)
      throw new AppError(
        "Post not published to Dev.to yet. Use POST to publish first.",
        ERROR_CODES.NOT_FOUND
      );

    if (!publication.integration.enabled)
      throw new AppError("Dev.to integration is disabled", ERROR_CODES.BAD_REQUEST);

    let result: Awaited<ReturnType<typeof updateDevtoArticle>>;
    try {
      result = await updateDevtoArticle(
        publication.integration.apiKey,
        publication.devtoArticleId,
        {
          title: post.title,
          body_markdown: post.markdown,
          published: published ?? !publication.publishedAsDraft,
          tags: tags ?? [],
          canonical_url: canonicalUrl,
          series,
        }
      );
    } catch (err) {
      if (err instanceof DevtoApiError) {
        throw new AppError(
          err.message,
          ERROR_CODES.BAD_REQUEST,
          err.status === 401 ? 400 : err.status,
          { devtoCode: err.code }
        );
      }
      throw err;
    }

    await db
      .update(devtoPublications)
      .set({
        devtoUrl: result.url,
        publishedAsDraft: !result.published,
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(devtoPublications.postId, postId));

    if (result.published) {
      await db
        .update(posts)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(posts.id, postId));
    }

    return NextResponse.json({
      devtoArticleId: result.id,
      devtoUrl: result.url,
      published: result.published,
    });
  })(request);
}
