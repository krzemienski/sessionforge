import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { generateMetaSuggestions } from "@/lib/seo/meta-generator";

export const dynamic = "force-dynamic";

/**
 * POST /api/content/[id]/seo/generate-meta
 *
 * Uses AI to generate optimised meta title, description, keywords, and OG
 * image prompt for the specified post. Returns suggestions only — the caller
 * decides whether to persist the accepted values.
 *
 * Body (optional): { targetAudience?: string; contentDomain?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: {
      id: true,
      title: true,
      markdown: true,
    },
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { targetAudience, contentDomain } = body as {
    targetAudience?: string;
    contentDomain?: string;
  };

  try {
    const suggestions = await generateMetaSuggestions({
      content: post.markdown,
      title: post.title,
      targetAudience,
      contentDomain,
    });

    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate meta suggestions" },
      { status: 500 }
    );
  }
}
