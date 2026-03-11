import { notFound } from "next/navigation";
import { BioSection } from "@/components/portfolio/bio-section";
import { PostGrid } from "@/components/portfolio/post-grid";

// This is a public route - no authentication required
export const dynamic = "force-dynamic";

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
        cache: "no-store",
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
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const data = await getPortfolioData(workspace);

  if (!data) {
    notFound();
  }

  const { workspace: workspaceData, portfolio, pinnedPosts, posts, series, collections } = data;

  return (
    <div className="min-h-screen bg-sf-bg-primary">
      {/* Header */}
      <header className="border-b border-sf-border bg-sf-bg-secondary">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold font-display text-sf-text-primary">
            {workspaceData.name}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
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

          {/* Post Grid with Filtering */}
          <PostGrid
            posts={posts}
            pinnedPosts={pinnedPosts}
            series={series}
            collections={collections}
          />
        </div>
      </main>

      {/* Footer */}
      {portfolio.showPoweredBy && (
        <footer className="border-t border-sf-border mt-16">
          <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-sf-text-muted">
            Powered by{" "}
            <a
              href="https://sessionforge.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sf-accent hover:underline"
            >
              SessionForge
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}
