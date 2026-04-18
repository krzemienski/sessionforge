/**
 * Content UI row types. Focused subsets of the Drizzle `posts` /
 * `series` / `collections` / `contentRecommendations` schemas — only
 * the fields the content components actually read.
 *
 * Introduced Wave 4b (M12) to replace `any[]` list-component props with
 * real typing. Keep narrow: adding fields only when a component needs
 * them prevents this file from drifting into a schema clone.
 */

export interface ContentListItem {
  id: string;
  title: string | null;
  markdown: string | null;
  status: string | null;
  contentType: string;
  wordCount?: number | null;
  updatedAt?: string | Date | null;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  parentPostId?: string | null;
  derivativeCount?: number;
  seoScore?: number | null;
  geoScore?: number | null;
  readabilityScore?: number | null;
  seoAnalysis?: { compositeScore?: number | null } | null;
}

export interface SeriesListItem {
  id: string;
  title: string;
  postCount: number;
}

export interface CollectionListItem {
  id: string;
  title: string;
  postCount: number;
}

export interface RecommendationRow {
  id: string;
  title: string;
  reasoning: string;
  suggestedPublishTime?: string | null;
  suggestedContentType?: string | null;
  contentType?: string | null;
  priority?: number | string | null;
  insightScore?: number | null;
}
