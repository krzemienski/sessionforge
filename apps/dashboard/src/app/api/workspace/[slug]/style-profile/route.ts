import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writingStyleProfiles, posts } from "@sessionforge/db";
import { eq, and, count, isNotNull } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(session, slug);

    const wsId = workspace.id;

    const profile = await db
      .select()
      .from(writingStyleProfiles)
      .where(eq(writingStyleProfiles.workspaceId, wsId))
      .limit(1);

    if (profile.length > 0 && profile[0].generationStatus === "completed") {
      return NextResponse.json(profile[0]);
    }

    const [{ value: publishedCount }] = await db
      .select({ value: count() })
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, wsId),
          eq(posts.status, "published"),
          isNotNull(posts.aiDraftMarkdown)
        )
      );

    if (profile.length > 0) {
      return NextResponse.json({
        ...profile[0],
        status: profile[0].generationStatus,
        publishedCount,
      });
    }

    return NextResponse.json({ status: "insufficient_data", publishedCount });
  })(req);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_SETTINGS
    );

    const wsId = workspace.id;
    const body = await req.json().catch(() => ({}));

    const {
      formality,
      technicalDepth,
      humor,
      headingStyle,
      codeStyle,
      vocabularyPatterns,
    } = body as Record<string, unknown>;

    const updateValues: Record<string, unknown> = {};
    if (formality !== undefined) updateValues.formality = formality;
    if (technicalDepth !== undefined) updateValues.technicalDepth = technicalDepth;
    if (humor !== undefined) updateValues.humor = humor;
    if (headingStyle !== undefined) updateValues.headingStyle = headingStyle;
    if (codeStyle !== undefined) updateValues.codeStyle = codeStyle;
    if (vocabularyPatterns !== undefined) updateValues.vocabularyPatterns = vocabularyPatterns;

    const existing = await db
      .select({ id: writingStyleProfiles.id })
      .from(writingStyleProfiles)
      .where(eq(writingStyleProfiles.workspaceId, wsId))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(writingStyleProfiles)
        .set(updateValues)
        .where(eq(writingStyleProfiles.workspaceId, wsId))
        .returning();
    } else {
      [result] = await db
        .insert(writingStyleProfiles)
        .values({ workspaceId: wsId, ...updateValues })
        .returning();
    }

    return NextResponse.json(result);
  })(req);
}
