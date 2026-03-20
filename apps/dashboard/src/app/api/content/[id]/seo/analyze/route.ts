import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { extractKeywords } from "@/lib/seo/keyword-extractor";
import { scoreReadability } from "@/lib/seo/readability-scorer";
import { generateStructuredData } from "@/lib/seo/structured-data-generator";
import { analyzeGeo } from "@/lib/seo/geo-optimizer";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/content/[id]/seo/analyze
 *
 * Runs a full SEO and GEO analysis on a post's markdown content.
 * Extracts keywords, calculates Flesch-Kincaid readability, generates
 * JSON-LD structured data, and evaluates GEO criteria. Persists the
 * results to the posts table and returns the complete analysis.
 *
 * Body (optional): { regenerate?: boolean }
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
        workspaceId: true,
        readabilityScore: true,
        geoScore: true,
      },
    });

    if (!post) {
      throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, post.workspaceId, PERMISSIONS.CONTENT_EDIT);

    const body = await request.json().catch(() => ({}));
    const { regenerate = false } = body as { regenerate?: boolean };

    // Skip re-analysis if scores already exist and regenerate is not requested
    if (!regenerate && post.readabilityScore !== null && post.geoScore !== null) {
      return NextResponse.json({ message: "Analysis already up to date", id });
    }

    const markdown = post.markdown;

    // Run all analyses in parallel for performance
    const [keywords, readability, structuredDataResult, geoResult] = await Promise.all([
      Promise.resolve(extractKeywords(markdown, { maxKeywords: 20 })),
      Promise.resolve(scoreReadability(markdown)),
      Promise.resolve(
        generateStructuredData({
          content: markdown,
          title: post.title,
          datePublished: new Date().toISOString(),
          author: { name: "Author" },
          publisher: { name: "SessionForge" },
        })
      ),
      Promise.resolve(analyzeGeo(markdown)),
    ]);

    // Build a GEO checklist compatible with the DB schema
    const geoChecklist = geoResult.checks.map((check) => ({
      id: check.id,
      label: check.name,
      passed: check.passed,
      suggestion: check.suggestions[0] ?? undefined,
    }));

    // Composite SEO score: average of readability (0-100) and GEO score (0-100)
    const compositeScore = (readability.score + geoResult.score) / 2;

    const seoAnalysis = {
      compositeScore: Math.round(compositeScore * 10) / 10,
      readability: {
        score: readability.score,
        gradeLevel: readability.gradeLevel,
        readingLevel: readability.readingLevel,
        wordCount: readability.wordCount,
        sentenceCount: readability.sentenceCount,
        suggestions: readability.suggestions,
      },
      geo: {
        score: geoResult.score,
        passed: geoResult.passed,
        total: geoResult.total,
      },
      keywords: keywords.map((k) => k.keyword),
      schemaType: structuredDataResult.type,
      analyzedAt: new Date().toISOString(),
    };

    await db
      .update(posts)
      .set({
        keywords: keywords.map((k) => k.keyword),
        structuredData: structuredDataResult.schema,
        readabilityScore: readability.score,
        geoScore: geoResult.score,
        geoChecklist,
        seoAnalysis,
      })
      .where(eq(posts.id, id));

    return NextResponse.json({
      id,
      keywords,
      readability,
      structuredData: structuredDataResult,
      geo: geoResult,
      seoAnalysis,
    });
  })(request);
}
