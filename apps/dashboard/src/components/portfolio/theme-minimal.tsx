import { ReactNode } from "react";

interface ThemeMinimalProps {
  workspaceName: string;
  workspaceSlug: string;
  showRss?: boolean;
  showPoweredBy?: boolean;
  children: ReactNode;
}

export function ThemeMinimal({
  workspaceName,
  workspaceSlug,
  showRss = false,
  showPoweredBy = true,
  children,
}: ThemeMinimalProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-black">
            {workspaceName}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
            {/* RSS Link */}
            {showRss && (
              <a
                href={`/${workspaceSlug}/rss`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-black hover:underline"
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
                  className="text-black hover:underline"
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
