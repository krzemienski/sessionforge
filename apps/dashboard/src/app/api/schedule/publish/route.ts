import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, scheduledPublications, devtoIntegrations, devtoPublications } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { verifyQStashRequest, isQStashAvailable, createPublishSchedule } from "@/lib/qstash";
import { publishToDevto } from "@/lib/integrations/devto";
import { publishWithRetry } from "@/lib/integrations/retry-publisher";
import type { PublishResult } from "@/lib/scheduling/publisher";

export const dynamic = "force-dynamic";

/** Delay (in ms) before a fallback re-attempt is scheduled via QStash. */
const FALLBACK_DELAY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Determines whether a publish error is an authentication failure.
 */
function isAuthFailure(errorMessage: string): boolean {
  return (
    errorMessage.includes("Authentication failed") ||
    errorMessage.includes("401") ||
    errorMessage.includes("403")
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const isValid = await verifyQStashRequest(request, rawBody).catch(() => false);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { postId?: string };
  const { postId } = body;

  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  // Fetch post with workspace
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Fetch scheduled publication (pending or retry_exhausted for re-attempts)
  const scheduled = await db.query.scheduledPublications.findFirst({
    where: and(
      eq(scheduledPublications.postId, postId),
      eq(scheduledPublications.status, "pending")
    ),
  });

  // Also check for retry_exhausted publications (fallback re-attempts)
  const retryExhausted = !scheduled
    ? await db.query.scheduledPublications.findFirst({
        where: and(
          eq(scheduledPublications.postId, postId),
          eq(scheduledPublications.status, "retry_exhausted")
        ),
      })
    : null;

  const publication = scheduled ?? retryExhausted;

  if (!publication) {
    return NextResponse.json(
      { error: "No pending or retriable scheduled publication found" },
      { status: 404 }
    );
  }

  // Update status to "publishing"
  await db
    .update(scheduledPublications)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(eq(scheduledPublications.id, publication.id));

  const platforms = publication.platforms as string[];
  let allSucceeded = true;
  let authFailureDetected = false;
  let retryExhaustedDetected = false;
  let lastError: string | undefined;

  for (const platform of platforms) {
    if (platform === "devto") {
      // Check for Dev.to integration
      const integration = await db.query.devtoIntegrations.findFirst({
        where: and(
          eq(devtoIntegrations.workspaceId, post.workspaceId),
          eq(devtoIntegrations.enabled, true)
        ),
      });

      if (!integration) {
        allSucceeded = false;
        lastError = "Dev.to integration not configured or disabled";
        continue;
      }

      // Use retry-publisher for resilient publishing
      const retryResult = await publishWithRetry({
        publishFn: async (): Promise<PublishResult> => {
          const result = await publishToDevto(integration.apiKey, {
            title: post.title,
            body_markdown: post.markdown,
            published: true,
            tags: [],
          });

          // Record publication
          await db.insert(devtoPublications).values({
            workspaceId: post.workspaceId,
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
        workspaceId: post.workspaceId,
      });

      if (!retryResult.result.success) {
        allSucceeded = false;
        lastError = retryResult.result.error;

        // Check if this is an auth failure
        if (lastError && isAuthFailure(lastError)) {
          authFailureDetected = true;
        } else if (retryResult.attempts >= 4) {
          // Retries exhausted for non-auth failures
          retryExhaustedDetected = true;
        }
      }
    }
  }

  // Handle auth failure: pause the scheduled publication
  if (authFailureDetected) {
    await db
      .update(scheduledPublications)
      .set({
        status: "paused",
        error: lastError ?? "Authentication expired — will retry after re-authentication",
        updatedAt: new Date(),
      })
      .where(eq(scheduledPublications.id, publication.id));

    return NextResponse.json(
      {
        success: false,
        postId,
        status: "paused",
        error: "Authentication expired — publication paused for automatic retry",
      },
      { status: 200 }
    );
  }

  // Handle retry exhaustion: mark retry_exhausted and schedule fallback via QStash
  if (retryExhaustedDetected) {
    await db
      .update(scheduledPublications)
      .set({
        status: "retry_exhausted",
        error: lastError ?? "Publishing failed after all retry attempts",
        updatedAt: new Date(),
      })
      .where(eq(scheduledPublications.id, publication.id));

    // Schedule a delayed re-attempt via QStash as a fallback queue
    if (isQStashAvailable()) {
      try {
        const fallbackTime = new Date(Date.now() + FALLBACK_DELAY_MS);
        await createPublishSchedule(postId, fallbackTime);
      } catch {
        // Fallback scheduling failed — the publication stays as retry_exhausted
        // and can be manually retried or picked up by a future health check
      }
    }

    return NextResponse.json(
      {
        success: false,
        postId,
        status: "retry_exhausted",
        error: "Publishing failed after all retries — fallback re-attempt scheduled",
      },
      { status: 200 }
    );
  }

  if (!allSucceeded) {
    // Non-auth, non-exhausted failure (e.g., integration not configured)
    await db
      .update(scheduledPublications)
      .set({
        status: "failed",
        error: lastError ?? "Publishing failed",
        updatedAt: new Date(),
      })
      .where(eq(scheduledPublications.id, publication.id));

    return NextResponse.json(
      { error: lastError ?? "Publishing failed" },
      { status: 500 }
    );
  }

  // All platforms succeeded
  await db
    .update(posts)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(posts.id, postId));

  await db
    .update(scheduledPublications)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(scheduledPublications.id, publication.id));

  return NextResponse.json({ success: true, postId, published: true });
}
