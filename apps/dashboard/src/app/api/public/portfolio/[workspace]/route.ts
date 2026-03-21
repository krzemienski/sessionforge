import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  workspaces,
  portfolioSettings,
  posts,
  series,
  collections,
  seriesPosts,
  collectionPosts,
} from "@sessionforge/db";
import { eq, and, inArray } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string }> }
) {
  const { workspace: workspaceSlug } = await params;

  // Look up workspace by slug
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Look up portfolio settings
  const portfolio = await db.query.portfolioSettings.findFirst({
    where: eq(portfolioSettings.workspaceId, workspace.id),
  });

  if (!portfolio || !portfolio.isEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get published posts for this workspace
  const publishedPosts = await db.query.posts.findMany({
    where: and(
      eq(posts.workspaceId, workspace.id),
      eq(posts.status, "published")
    ),
    orderBy: (p, { desc }) => [desc(p.publishedAt)],
  });

  // Get series for this workspace
  const workspaceSeries = await db.query.series.findMany({
    where: eq(series.workspaceId, workspace.id),
  });

  // Get collections for this workspace
  const workspaceCollections = await db.query.collections.findMany({
    where: and(
      eq(collections.workspaceId, workspace.id),
      eq(collections.isPublic, true)
    ),
  });

  // Fetch series and collection membership for published posts
  const publishedPostIds = publishedPosts.map((p) => p.id);

  let postSeriesMap: Record<string, string> = {};
  let postCollectionsMap: Record<string, string[]> = {};

  if (publishedPostIds.length > 0) {
    const seriesPostRows = await db
      .select({ postId: seriesPosts.postId, seriesId: seriesPosts.seriesId })
      .from(seriesPosts)
      .where(inArray(seriesPosts.postId, publishedPostIds));

    postSeriesMap = seriesPostRows.reduce((acc, row) => {
      acc[row.postId] = row.seriesId;
      return acc;
    }, {} as Record<string, string>);

    const collectionPostRows = await db
      .select({ postId: collectionPosts.postId, collectionId: collectionPosts.collectionId })
      .from(collectionPosts)
      .where(inArray(collectionPosts.postId, publishedPostIds));

    postCollectionsMap = collectionPostRows.reduce((acc, row) => {
      if (!acc[row.postId]) acc[row.postId] = [];
      acc[row.postId].push(row.collectionId);
      return acc;
    }, {} as Record<string, string[]>);
  }

  // Process pinned posts if they exist
  const pinnedPostIds = (portfolio.pinnedPostIds as string[]) || [];
  const pinnedPostsData =
    pinnedPostIds.length > 0
      ? publishedPosts.filter((p) => pinnedPostIds.includes(p.id))
      : [];

  // Sort pinned posts by their order in pinnedPostIds
  const sortedPinnedPosts = pinnedPostsData.sort((a, b) => {
    return pinnedPostIds.indexOf(a.id) - pinnedPostIds.indexOf(b.id);
  });

  // Map posts for response
  const mappedPosts = publishedPosts.map((p) => ({
    id: p.id,
    title: p.title,
    contentType: p.contentType,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
    metaDescription: p.metaDescription,
    wordCount: p.wordCount,
    keywords: p.keywords,
    seriesId: postSeriesMap[p.id] ?? null,
    collectionIds: postCollectionsMap[p.id] ?? [],
  }));

  // Map pinned posts for response
  const mappedPinnedPosts = sortedPinnedPosts.map((p) => ({
    id: p.id,
    title: p.title,
    contentType: p.contentType,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
    metaDescription: p.metaDescription,
    wordCount: p.wordCount,
    keywords: p.keywords,
    seriesId: postSeriesMap[p.id] ?? null,
    collectionIds: postCollectionsMap[p.id] ?? [],
  }));

  // Map series for response
  const mappedSeries = workspaceSeries.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    slug: s.slug,
    coverImage: s.coverImage,
    isPublic: s.isPublic,
  }));

  // Map collections for response
  const mappedCollections = workspaceCollections.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    slug: c.slug,
    coverImage: c.coverImage,
    isPublic: c.isPublic,
  }));

  // Return portfolio data
  return NextResponse.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    portfolio: {
      bio: portfolio.bio,
      avatarUrl: portfolio.avatarUrl,
      socialLinks: portfolio.socialLinks,
      theme: portfolio.theme,
      showRss: portfolio.showRss,
      showPoweredBy: portfolio.showPoweredBy,
      customDomain: portfolio.customDomain,
    },
    pinnedPosts: mappedPinnedPosts,
    posts: mappedPosts,
    series: mappedSeries,
    collections: mappedCollections,
  });
}
