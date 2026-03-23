import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { validateStructuredData } from "@/lib/seo/structured-data-validator";
import type { StructuredData } from "@/lib/seo/structured-data-generator";

export const dynamic = "force-dynamic";

/**
 * POST /api/content/[id]/seo/validate
 *
 * Validates a post's structured data against schema.org rules and returns
 * validation results. If the post has no structured data stored, returns
 * a 404-style payload indicating there is nothing to validate.
 *
 * Body (optional): { structuredData?: object }
 *   When provided, validates the supplied structured data instead of the
 *   persisted value — useful for previewing validation before saving.
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
    with: { workspace: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { structuredData: inlineData } = body as {
    structuredData?: Record<string, unknown>;
  };

  // Use inline data if provided, otherwise fall back to the persisted value
  const dataToValidate = inlineData ?? (post as any).structuredData;

  if (!dataToValidate || typeof dataToValidate !== "object") {
    return NextResponse.json(
      {
        error: "No structured data available to validate",
        id,
        valid: false,
        issues: [],
        errorCount: 0,
        warningCount: 0,
      },
      { status: 422 }
    );
  }

  const result = validateStructuredData(dataToValidate as StructuredData);

  return NextResponse.json({
    id,
    ...result,
  });
}
