import { notFound } from "next/navigation";

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

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function estimateReadTime(wordCount: number | null): string {
  if (!wordCount) return "5 min read";
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min read`;
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

  const { workspace: workspaceData, portfolio, pinnedPosts, posts } = data;

  // Separate pinned and non-pinned posts
  const pinnedPostIds = new Set(pinnedPosts.map((p) => p.id));
  const regularPosts = posts.filter((p) => !pinnedPostIds.has(p.id));

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
        {portfolio.bio && (
          <div className="mb-12">
            <div className="bg-sf-bg-secondary border border-sf-border rounded-sf p-6">
              <h2 className="text-xl font-bold font-display mb-4 text-sf-text-primary">
                About
              </h2>
              <p className="text-sf-text-secondary whitespace-pre-wrap">
                {portfolio.bio}
              </p>

              {/* Social Links */}
              {portfolio.socialLinks &&
                typeof portfolio.socialLinks === "object" &&
                Object.keys(portfolio.socialLinks).length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {Object.entries(portfolio.socialLinks).map(
                      ([platform, url]) => {
                        if (!url || typeof url !== "string") return null;
                        return (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-sf-accent hover:underline"
                          >
                            {platform.charAt(0).toUpperCase() +
                              platform.slice(1)}
                          </a>
                        );
                      }
                    )}
                  </div>
                )}
            </div>
          </div>
        )}

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

          {/* Pinned Posts */}
          {pinnedPosts.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-sf-text-muted mb-4">
                Pinned Posts
              </h3>
              <div className="space-y-4">
                {pinnedPosts.map((post) => (
                  <article
                    key={post.id}
                    className="bg-sf-bg-secondary border border-sf-border rounded-sf p-6 hover:border-sf-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2 text-sf-text-primary">
                          {post.title}
                        </h3>
                        {post.metaDescription && (
                          <p className="text-sm text-sf-text-secondary mb-3 line-clamp-2">
                            {post.metaDescription}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-sf-text-muted">
                          <span>{formatDate(post.publishedAt)}</span>
                          <span>•</span>
                          <span>{estimateReadTime(post.wordCount)}</span>
                          <span>•</span>
                          <span className="capitalize">
                            {post.contentType.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                      <div className="px-2.5 py-1 bg-sf-accent/10 border border-sf-accent/20 rounded-sf text-xs font-medium text-sf-accent">
                        Pinned
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Regular Posts */}
          {regularPosts.length > 0 && (
            <div className="space-y-4">
              {regularPosts.map((post) => (
                <article
                  key={post.id}
                  className="bg-sf-bg-secondary border border-sf-border rounded-sf p-6 hover:border-sf-accent/50 transition-colors"
                >
                  <h3 className="text-lg font-semibold mb-2 text-sf-text-primary">
                    {post.title}
                  </h3>
                  {post.metaDescription && (
                    <p className="text-sm text-sf-text-secondary mb-3 line-clamp-2">
                      {post.metaDescription}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-sf-text-muted">
                    <span>{formatDate(post.publishedAt)}</span>
                    <span>•</span>
                    <span>{estimateReadTime(post.wordCount)}</span>
                    <span>•</span>
                    <span className="capitalize">
                      {post.contentType.replace(/_/g, " ")}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {posts.length === 0 && (
            <div className="text-center py-12 text-sf-text-muted">
              <p>No content published yet.</p>
            </div>
          )}
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
