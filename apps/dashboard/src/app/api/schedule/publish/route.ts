import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, scheduledPublications, devtoIntegrations, devtoPublications } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { verifyQStashRequest } from "@/lib/qstash";
import { publishToDevto, DevtoApiError } from "@/lib/integrations/devto";

export const dynamic = "force-dynamic";

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

  // Fetch scheduled publication
  const scheduled = await db.query.scheduledPublications.findFirst({
    where: and(
      eq(scheduledPublications.postId, postId),
      eq(scheduledPublications.status, "pending")
    ),
  });

  if (!scheduled) {
    return NextResponse.json(
      { error: "No pending scheduled publication found" },
      { status: 404 }
    );
  }

  // Update status to "publishing"
  await db
    .update(scheduledPublications)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(eq(scheduledPublications.id, scheduled.id));

  try {
    const platforms = scheduled.platforms as string[];

    // Publish to each platform
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
          throw new Error("Dev.to integration not configured or disabled");
        }

        // Check if already published
        const existing = await db.query.devtoPublications.findFirst({
          where: eq(devtoPublications.postId, postId),
        });

        if (existing) {
          // Already published, skip
          continue;
        }

        // Publish to Dev.to
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
      }
    }

    // Update post status to published
    await db
      .update(posts)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(posts.id, postId));

    // Update scheduled publication to published
    await db
      .update(scheduledPublications)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scheduledPublications.id, scheduled.id));

    return NextResponse.json({ success: true, postId, published: true });
  } catch (error) {
    // Update scheduled publication to failed with error
    await db
      .update(scheduledPublications)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Publishing failed",
        updatedAt: new Date(),
      })
      .where(eq(scheduledPublications.id, scheduled.id));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publishing failed" },
      { status: 500 }
    );
  }
}
