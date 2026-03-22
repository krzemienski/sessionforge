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
import type { SeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Type cast helper: the seoMetadata column may not be in the inferred type.
type PostRow = Awaited<
  ReturnType<typeof db.query.posts.findFirst<{ with: { workspace: true; author: true; insight: true } }>>
>;
type PostWithSeo = NonNullable<PostRow> & { seoMetadata?: SeoMetadata | null };

/**
 * POST /api/content/[id]/seo/analyze
 *
 * Runs a full SEO and GEO analysis on a post's markdown content.
 * Extracts keywords, calculates Flesch-Kincaid readability, generates
 * JSON-LD structured data, and evaluates GEO criteria. Auto-populates
 * OG/Twitter social meta fields from the post title and description when
 * not already set. Persists the results to the posts table and returns
 * the complete analysis.
 *
 * Body (optional): { regenerate?: boolean }
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

  const post = (await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { workspace: true, author: true, insight: true },
  })) as PostWithSeo | undefined;

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { regenerate = false } = body as { regenerate?: boolean };

  // Skip re-analysis if scores already exist and regenerate is not requested
  if (!regenerate && post.readabilityScore !== null && post.geoScore !== null) {
    return NextResponse.json({ message: "Analysis already up to date", id });
  }

  const markdown = post.markdown;

  // Resolve real author and publisher names from workspace relations
  const authorName = post.author?.name ?? session.user.name ?? "Author";
  const publisherName = post.workspace.name ?? "SessionForge";

  // Derive a description from the insight or metaDescription for social meta fallback
  const postDescription =
    post.insight?.description ?? post.metaDescription ?? "";

  // Run all analyses in parallel for performance
  const [keywords, readability, structuredDataResult, geoResult] = await Promise.all([
    Promise.resolve(extractKeywords(markdown, { maxKeywords: 20 })),
    Promise.resolve(scoreReadability(markdown)),
    Promise.resolve(
      generateStructuredData({
        content: markdown,
        title: post.title,
        datePublished: new Date().toISOString(),
        author: { name: authorName },
        publisher: { name: publisherName },
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

  // Auto-populate OG/Twitter social meta fields when not already set
  const existingMeta: SeoMetadata = post.seoMetadata ?? {};
  const socialMeta: Partial<SeoMetadata> = {
    ogTitle: existingMeta.ogTitle ?? post.title,
    ogDescription: existingMeta.ogDescription ?? (postDescription || null),
    twitterTitle: existingMeta.twitterTitle ?? post.title,
    twitterDescription: existingMeta.twitterDescription ?? (postDescription || null),
    twitterCard: existingMeta.twitterCard ?? "summary_large_image",
  };

  const mergedSeoMetadata: SeoMetadata = {
    ...existingMeta,
    ...socialMeta,
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
      seoMetadata: mergedSeoMetadata,
    } as any)
    .where(eq(posts.id, id));

  return NextResponse.json({
    id,
    keywords,
    readability,
    structuredData: structuredDataResult,
    geo: geoResult,
    seoAnalysis,
    seoMetadata: mergedSeoMetadata,
  });
}
