import { db } from "@/lib/db";
import { posts, devtoIntegrations, devtoPublications } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { publishToDevto } from "@/lib/integrations/devto";
import { publishWithRetry } from "@/lib/integrations/retry-publisher";
import { persistHealthCheckResults } from "@/lib/integrations/health-checker";
import type { HealthCheckResult } from "@/lib/integrations/health-checker";
import { eventBus } from "@/lib/observability/event-bus";
import { createAgentEvent } from "@/lib/observability/event-types";

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

// ── Health status check ──

/**
 * Checks whether a connector is paused (auth_expired) by reading the
 * integration table's healthStatus column. Returns true if paused.
 */
async function isConnectorPaused(
  workspaceId: string,
  platform: Platform
): Promise<boolean> {
  switch (platform) {
    case "devto": {
      const [row] = await db
        .select({ healthStatus: devtoIntegrations.healthStatus })
        .from(devtoIntegrations)
        .where(
          and(
            eq(devtoIntegrations.workspaceId, workspaceId),
            eq(devtoIntegrations.enabled, true)
          )
        )
        .limit(1);
      return row?.healthStatus === "paused";
    }
    default:
      return false;
  }
}

// ── Observability helpers ──

function emitPublishEvent(
  workspaceId: string,
  platform: Platform,
  action: string,
  payload: Record<string, unknown> = {}
): void {
  const traceId = crypto.randomUUID();
  eventBus.emit(
    createAgentEvent(traceId, workspaceId, "publisher", "pipeline:stage", {
      action,
      platform,
      ...payload,
    })
  );
}

function emitPublishError(
  workspaceId: string,
  platform: Platform,
  error: string,
  payload: Record<string, unknown> = {}
): void {
  const traceId = crypto.randomUUID();
  eventBus.emit(
    createAgentEvent(
      traceId,
      workspaceId,
      "publisher",
      "agent:error",
      { platform, error, ...payload },
      { level: "error" }
    )
  );
}

// ── Platform publish functions ──

async function publishToDevtoPlatform(
  postId: string,
  workspaceId: string,
  postTitle: string,
  postMarkdown: string
): Promise<PublishResult> {
  // (1) Check health status — skip if connector is paused
  const paused = await isConnectorPaused(workspaceId, "devto");
  if (paused) {
    emitPublishEvent(workspaceId, "devto", "publish_skipped", {
      postId,
      reason: "connector_paused",
    });
    return {
      platform: "devto",
      success: false,
      skipped: true,
      reason: "connector_paused",
    };
  }

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

  // (2) Wrap the publish call with the retry-publisher
  emitPublishEvent(workspaceId, "devto", "publish_attempt", { postId });

  const retryResult = await publishWithRetry({
    publishFn: async (): Promise<PublishResult> => {
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
    },
    platform: "devto",
    postId,
  });

  // Emit observability for retries
  if (retryResult.attempts > 1) {
    emitPublishEvent(workspaceId, "devto", "publish_retried", {
      postId,
      attempts: retryResult.attempts,
      idempotencyKey: retryResult.idempotencyKey,
    });
  }

  // (3) On auth failure, update connector health status to paused
  if (!retryResult.result.success && retryResult.result.error) {
    const isAuthFailure =
      retryResult.result.error.includes("Authentication failed") ||
      retryResult.result.error.includes("401") ||
      retryResult.result.error.includes("403");

    if (isAuthFailure) {
      const healthResult: HealthCheckResult = {
        platform: "devto",
        status: "auth_expired",
        responseTimeMs: 0,
        errorMessage: retryResult.result.error,
        errorCode: "auth_expired",
      };
      await persistHealthCheckResults(workspaceId, [healthResult]);

      emitPublishError(workspaceId, "devto", "auth_expired", {
        postId,
        attempts: retryResult.attempts,
      });
    } else {
      emitPublishError(workspaceId, "devto", retryResult.result.error, {
        postId,
        attempts: retryResult.attempts,
      });
    }
  }

  if (retryResult.result.success && !retryResult.result.skipped) {
    emitPublishEvent(workspaceId, "devto", "publish_success", {
      postId,
      url: retryResult.result.url,
      attempts: retryResult.attempts,
    });
  }

  return retryResult.result;
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
  const failedCount = results.filter((r) => !r.success && !r.skipped).length;
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
