import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BioSection } from "@/components/portfolio/bio-section";
import { PostGrid } from "@/components/portfolio/post-grid";
import { PortfolioLayout, ThemeMinimal, ThemeDeveloperDark, ThemeColorful } from "@/components/portfolio/portfolio-layout";

// This is a public route - no authentication required
// Enable ISR with 1 hour revalidation for better performance
export const revalidate = 3600;

interface PortfolioData {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  portfolio: {
    bio: string | null;
    avatarUrl: string | null;
    socialLinks: any;
    theme: string;
    showRss: boolean;
    showPoweredBy: boolean;
    customDomain: string | null;
  };
  pinnedPosts: Array<{
    id: string;
    title: string;
    contentType: string;
    publishedAt: Date | null;
    createdAt: Date;
    metaDescription: string | null;
    wordCount: number | null;
    keywords: any;
    seriesId: string | null;
    collectionIds: string[];
    status: string;
  }>;
  posts: Array<{
    id: string;
    title: string;
    contentType: string;
    publishedAt: Date | null;
    createdAt: Date;
    metaDescription: string | null;
    wordCount: number | null;
    keywords: any;
    seriesId: string | null;
    collectionIds: string[];
    status: string;
  }>;
  series: Array<{
    id: string;
    title: string;
    description: string | null;
    slug: string;
    coverImage: string | null;
    isPublic: boolean;
  }>;
  collections: Array<{
    id: string;
    title: string;
    description: string | null;
    slug: string;
    coverImage: string | null;
    isPublic: boolean;
  }>;
}

async function getPortfolioData(
  workspace: string
): Promise<PortfolioData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/public/portfolio/${workspace}`,
      {
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch (error) {
    console.error("Failed to fetch portfolio data:", error);
    return null;
  }
}

export default async function PublicPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { workspace } = await params;
  const { theme: themeParam } = await searchParams;
  const data = await getPortfolioData(workspace);

  if (!data) {
    notFound();
  }

  const { workspace: workspaceData, portfolio, pinnedPosts, posts, series, collections } = data;

  // Determine which theme to use (query param overrides portfolio settings for testing)
  const theme = themeParam || portfolio.theme || "default";

  // Select the appropriate theme component
  let ThemeComponent = PortfolioLayout;
  if (theme === "minimal") {
    ThemeComponent = ThemeMinimal;
  } else if (theme === "developer-dark") {
    ThemeComponent = ThemeDeveloperDark;
  } else if (theme === "colorful") {
    ThemeComponent = ThemeColorful;
  }

  return (
    <ThemeComponent
      workspaceName={workspaceData.name}
      workspaceSlug={workspaceData.slug}
      showRss={portfolio.showRss}
      showPoweredBy={portfolio.showPoweredBy}
    >
      {/* Bio Section */}
      <BioSection
        workspaceName={workspaceData.name}
        bio={portfolio.bio}
        avatarUrl={portfolio.avatarUrl}
        socialLinks={portfolio.socialLinks}
      />

      {/* Posts Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-display text-sf-text-primary">
            Content
          </h2>
          {portfolio.showRss && (
            <a
              href={`/${workspace}/rss`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-sf-accent hover:underline"
            >
              RSS Feed
            </a>
          )}
        </div>

        {/* Post Grid with Filtering — wrapped in Suspense for useSearchParams */}
        <Suspense fallback={<div className="py-12 text-center text-sf-text-muted">Loading...</div>}>
          <PostGrid
            posts={posts}
            pinnedPosts={pinnedPosts}
            series={series}
            collections={collections}
          />
        </Suspense>
      </div>
    </ThemeComponent>
  );
}
