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
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Type cast helper: node_modules/@sessionforge/db predates the seoMetadata column,
// so we extend the inferred post type locally to avoid TypeScript errors.
type PostRow = Awaited<
  ReturnType<typeof db.query.posts.findFirst<{ with: { workspace: true; insight: true } }>>
>;
type PostWithSeo = NonNullable<PostRow> & { seoMetadata?: SeoMetadata | null };

async function getPostWithAuth(
  id: string,
  session: Parameters<typeof getAuthorizedWorkspaceById>[0],
  permission: Parameters<typeof getAuthorizedWorkspaceById>[2]
): Promise<PostWithSeo> {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true, insight: true },
  });

  if (!post) {
    throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
  }

  await getAuthorizedWorkspaceById(session, post.workspaceId, permission);

  return post as PostWithSeo;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const post = await getPostWithAuth(id, session, PERMISSIONS.CONTENT_READ);

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
  })(_request);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const post = await getPostWithAuth(id, session, PERMISSIONS.CONTENT_EDIT);

    const insightData = post.insight
      ? {
          title: post.insight.title,
          description: post.insight.description,
          category: post.insight.category,
        }
      : undefined;

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
  })(_request);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const post = await getPostWithAuth(id, session, PERMISSIONS.CONTENT_EDIT);

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
  })(request);
}
