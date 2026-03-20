import { ReactNode } from "react";

interface PortfolioLayoutProps {
  workspaceName: string;
  workspaceSlug: string;
  showRss?: boolean;
  showPoweredBy?: boolean;
  children: ReactNode;
}

export function PortfolioLayout({
  workspaceName,
  workspaceSlug,
  showRss = false,
  showPoweredBy = true,
  children,
}: PortfolioLayoutProps) {
  return (
    <div className="min-h-screen bg-sf-bg-primary">
      {/* Header */}
      <header className="border-b border-sf-border bg-sf-bg-secondary">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold font-display text-sf-text-primary">
            {workspaceName}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-sf-border mt-16">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-sf-text-muted">
            {/* RSS Link */}
            {showRss && (
              <a
                href={`/api/public/portfolio/${workspaceSlug}/rss`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sf-accent hover:underline"
              >
                RSS Feed
              </a>
            )}

            {/* Powered By */}
            {showPoweredBy && (
              <div className={showRss ? "sm:ml-auto" : "mx-auto"}>
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
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

// Export theme components
export { ThemeMinimal } from "./theme-minimal";
export { ThemeDeveloperDark } from "./theme-developer-dark";
export { ThemeColorful } from "./theme-colorful";
