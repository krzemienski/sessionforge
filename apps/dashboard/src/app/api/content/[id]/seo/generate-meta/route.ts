import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { generateMetaSuggestions } from "@/lib/seo/meta-generator";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

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
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

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
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspace.id, PERMISSIONS.CONTENT_EDIT);

    const body = await request.json().catch(() => ({}));
    const { targetAudience, contentDomain } = body as {
      targetAudience?: string;
      contentDomain?: string;
    };

    const suggestions = await generateMetaSuggestions({
      content: post.markdown,
      title: post.title,
      targetAudience,
      contentDomain,
    });

    return NextResponse.json(suggestions);
  })(request);
}
