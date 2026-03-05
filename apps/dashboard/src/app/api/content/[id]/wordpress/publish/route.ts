import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, wordpressConnections } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { decryptAppPassword } from "@/lib/wordpress/crypto";
import { WordPressClient } from "@/lib/wordpress/client";
import { markdownToHtml } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 1. Verify post ownership via workspace join
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    return NextResponse.json(
      { error: "No WordPress connection configured for this workspace" },
      { status: 400 }
    );
  }

  const { siteUrl, username, encryptedAppPassword } = connectionRows[0];

  // 3. Decrypt app password
  let appPassword: string;
  try {
    appPassword = decryptAppPassword(encryptedAppPassword);
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt stored credentials" },
      { status: 500 }
    );
  }

  // Parse and validate request body
  const body = await req.json().catch(() => ({}));
  const {
    status = "draft",
    excerpt,
    categories,
    tags,
    featuredMediaId,
  } = body as {
    status?: "draft" | "publish";
    excerpt?: string;
    categories?: number[];
    tags?: number[];
    featuredMediaId?: number;
  };

  if (status !== "draft" && status !== "publish") {
    return NextResponse.json(
      { error: "status must be 'draft' or 'publish'" },
      { status: 400 }
    );
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
}
