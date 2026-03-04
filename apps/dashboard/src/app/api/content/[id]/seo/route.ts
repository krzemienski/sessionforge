import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import {
  computeSeoScore,
  computeReadabilityScore,
  type SeoMetadata,
} from "@/lib/seo";
import { generateSeoMetadata } from "@/lib/seo/generator";

export const dynamic = "force-dynamic";

// Type cast helper: node_modules/@sessionforge/db predates the seoMetadata column,
// so we extend the inferred post type locally to avoid TypeScript errors.
type PostRow = Awaited<
  ReturnType<typeof db.query.posts.findFirst<{ with: { workspace: true; insight: true } }>>
>;
type PostWithSeo = NonNullable<PostRow> & { seoMetadata?: SeoMetadata | null };

async function getPostWithOwnership(
  id: string,
  userId: string
): Promise<
  | { error: string; status: 404 | 403 }
  | { post: PostWithSeo }
> {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true, insight: true },
  });

  if (!post) {
    return { error: "Post not found", status: 404 };
  }

  if (post.workspace.ownerId !== userId) {
    return { error: "Forbidden", status: 403 };
  }

  return { post: post as PostWithSeo };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await getPostWithOwnership(id, session.user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { post } = result;
  const seoScore = computeSeoScore(
    post.markdown,
    post.title,
    post.seoMetadata ?? undefined
  );
  const readability = computeReadabilityScore(post.markdown);

  return NextResponse.json({
    seoMetadata: post.seoMetadata ?? null,
    seoScore,
    readability,
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await getPostWithOwnership(id, session.user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { post } = result;

  const insightData = post.insight
    ? {
        title: post.insight.title,
        description: post.insight.description,
        category: post.insight.category,
      }
    : undefined;

  try {
    const generated = await generateSeoMetadata(
      post.markdown,
      post.title,
      insightData
    );


    const [updated] = await db
      .update(posts)
      .set({ seoMetadata: generated } as any)
      .where(eq(posts.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SEO generation failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await getPostWithOwnership(id, session.user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { post } = result;

  try {
    const body = (await request.json()) as Partial<SeoMetadata>;

    const merged: SeoMetadata = {
      ...(post.seoMetadata ?? {}),
      ...body,
    };


    await db
      .update(posts)
      .set({ seoMetadata: merged } as any)
      .where(eq(posts.id, id));

    return NextResponse.json({ seoMetadata: merged });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
