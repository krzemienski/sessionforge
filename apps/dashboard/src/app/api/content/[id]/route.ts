import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { updatePost } from "@/lib/ai/tools/post-manager";
import { withFrontmatter } from "@/lib/seo/frontmatter";
import type { SeoMetadata } from "@/lib/seo/scoring";

// seoMetadata column predates the TypeScript schema, so we extend the inferred type locally.
type PostRow = Awaited<
  ReturnType<typeof db.query.posts.findFirst<{ with: { workspace: true; insight: true } }>>
>;
type PostWithSeo = NonNullable<PostRow> & { seoMetadata?: SeoMetadata | null };

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true, insight: true },
  }) as PostWithSeo | undefined;

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("frontmatter") === "true") {
    return NextResponse.json({
      ...post,
      markdown: withFrontmatter(post.markdown ?? "", post.title, post.seoMetadata ?? {}),
      hasFrontmatter: true,
    });
  }

  return NextResponse.json(post);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, markdown, status, toneUsed, badgeEnabled, platformFooterEnabled } = body;

  try {
    const updated = await updatePost(existing.workspaceId, id, {
      title,
      markdown,
      status,
      toneUsed,
      badgeEnabled,
      platformFooterEnabled,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(posts).where(eq(posts.id, id));

  return NextResponse.json({ deleted: true });
}
