import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, integrationSettings } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { publishToHashnode } from "@/lib/publishing/hashnode";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Load post with workspace to verify ownership
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

  if (!post.markdown || !post.title) {
    return NextResponse.json(
      { error: "Post must have a title and content before publishing" },
      { status: 400 }
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
    return NextResponse.json(
      { error: "Hashnode API token not configured. Go to Settings > Integrations to connect your Hashnode account." },
      { status: 400 }
    );
  }

  if (!integration.hashnodePublicationId) {
    return NextResponse.json(
      { error: "Hashnode publication ID not configured. Go to Settings > Integrations to set your publication." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({})) as {
    tags?: string[];
    subtitle?: string;
    coverImageUrl?: string;
    seoTitle?: string;
    seoDescription?: string;
    canonicalUrl?: string;
  };

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
      contentMarkdown: post.markdown,
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
}
