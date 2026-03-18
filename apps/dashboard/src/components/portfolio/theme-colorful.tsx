import { ReactNode } from "react";

interface ThemeColorfulProps {
  workspaceName: string;
  workspaceSlug: string;
  showRss?: boolean;
  showPoweredBy?: boolean;
  children: ReactNode;
}

export function ThemeColorful({
  workspaceName,
  workspaceSlug,
  showRss = false,
  showPoweredBy = true,
  children,
}: ThemeColorfulProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white drop-shadow-md">
            {workspaceName}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 mt-16 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white">
            {/* RSS Link */}
            {showRss && (
              <a
                href={`/${workspaceSlug}/rss`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:text-yellow-200 transition-colors"
              >
                📡 RSS Feed
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
                  className="font-semibold hover:text-yellow-200 transition-colors underline decoration-2 underline-offset-2"
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
