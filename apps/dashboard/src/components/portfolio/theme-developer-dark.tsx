import { ReactNode } from "react";

interface ThemeDeveloperDarkProps {
  workspaceName: string;
  workspaceSlug: string;
  showRss?: boolean;
  showPoweredBy?: boolean;
  children: ReactNode;
}

export function ThemeDeveloperDark({
  workspaceName,
  workspaceSlug,
  showRss = false,
  showPoweredBy = true,
  children,
}: ThemeDeveloperDarkProps) {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-mono font-semibold text-green-400">
            $ {workspaceName}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            {/* RSS Link */}
            {showRss && (
              <a
                href={`/api/public/portfolio/${workspaceSlug}/rss`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:underline font-mono"
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
                  className="text-green-400 hover:underline font-mono"
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
