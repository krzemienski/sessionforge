import { db } from "@/lib/db";
import { posts, devtoIntegrations, devtoPublications } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { publishToDevto, DevtoApiError } from "@/lib/integrations/devto";

export type Platform = "devto";

export interface PublishResult {
  platform: Platform;
  success: boolean;
  url?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

export interface PublishToAllPlatformsResult {
  postId: string;
  results: PublishResult[];
  overallSuccess: boolean;
  publishedCount: number;
  failedCount: number;
  skippedCount: number;
}

export class PublishingError extends Error {
  constructor(
    message: string,
    public readonly platform: Platform,
    public readonly code: "integration_not_found" | "already_published" | "api_error" | "unknown"
  ) {
    super(message);
    this.name = "PublishingError";
  }
}

async function publishToDevtoPlatform(
  postId: string,
  workspaceId: string,
  postTitle: string,
  postMarkdown: string
): Promise<PublishResult> {
  try {
    // Check for Dev.to integration
    const integration = await db.query.devtoIntegrations.findFirst({
      where: and(
        eq(devtoIntegrations.workspaceId, workspaceId),
        eq(devtoIntegrations.enabled, true)
      ),
    });

    if (!integration) {
      return {
        platform: "devto",
        success: false,
        error: "Dev.to integration not configured or disabled",
      };
    }

    // Check if already published
    const existing = await db.query.devtoPublications.findFirst({
      where: eq(devtoPublications.postId, postId),
    });

    if (existing) {
      return {
        platform: "devto",
        success: true,
        skipped: true,
        reason: "Already published to Dev.to",
        url: existing.devtoUrl,
      };
    }

    // Publish to Dev.to
    const result = await publishToDevto(integration.apiKey, {
      title: postTitle,
      body_markdown: postMarkdown,
      published: true,
      tags: [],
    });

    // Record publication
    await db.insert(devtoPublications).values({
      workspaceId,
      postId,
      integrationId: integration.id,
      devtoArticleId: result.id,
      devtoUrl: result.url,
      publishedAsDraft: !result.published,
      syncedAt: new Date(),
    });

    return {
      platform: "devto",
      success: true,
      url: result.url,
    };
  } catch (error) {
    if (error instanceof DevtoApiError) {
      return {
        platform: "devto",
        success: false,
        error: error.message,
      };
    }

    return {
      platform: "devto",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error publishing to Dev.to",
    };
  }
}

export async function publishToAllPlatforms(
  postId: string,
  platforms: Platform[]
): Promise<PublishToAllPlatformsResult> {
  // Fetch post with workspace
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { workspace: true },
  });

  if (!post) {
    throw new Error(`Post not found: ${postId}`);
  }

  const results: PublishResult[] = [];

  // Publish to each platform
  for (const platform of platforms) {
    let result: PublishResult;

    switch (platform) {
      case "devto":
        result = await publishToDevtoPlatform(
          postId,
          post.workspaceId,
          post.title,
          post.markdown
        );
        break;

      default:
        result = {
          platform,
          success: false,
          error: `Platform not supported: ${platform}`,
        };
    }

    results.push(result);
  }

  // Calculate summary statistics
  const publishedCount = results.filter((r) => r.success && !r.skipped).length;
  const failedCount = results.filter((r) => !r.success).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const overallSuccess = failedCount === 0 && results.length > 0;

  return {
    postId,
    results,
    overallSuccess,
    publishedCount,
    failedCount,
    skippedCount,
  };
}
