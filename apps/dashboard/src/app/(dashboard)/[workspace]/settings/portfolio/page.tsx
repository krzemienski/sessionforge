"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";

export default function PortfolioSettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();

  const portfolioSettings = useQuery({
    queryKey: ["portfolio-settings", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/settings?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load portfolio settings");
      return res.json();
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Globe size={22} className="text-sf-accent" />
        <h1 className="text-2xl font-bold font-display">Portfolio Settings</h1>
      </div>

      <div className="max-w-3xl">
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-sf-text-primary mb-3">
            Public Portfolio
          </h2>
          <p className="text-sm text-sf-text-secondary mb-4">
            Enable a public portfolio page at{" "}
            <code className="font-code text-sf-accent">
              sessionforge.dev/{workspace}
            </code>{" "}
            to showcase your published content.
          </p>

          {portfolioSettings.isLoading ? (
            <div className="text-sm text-sf-text-muted">Loading settings...</div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-sf-text-primary font-medium">
                Portfolio Status:
              </span>
              <span
                className={`text-sm px-3 py-1 rounded-sf border ${
                  portfolioSettings.data?.isEnabled
                    ? "bg-green-500/15 text-green-400 border-green-500/25"
                    : "bg-gray-500/15 text-gray-400 border-gray-500/25"
                }`}
              >
                {portfolioSettings.data?.isEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          )}
        </div>

        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-5">
          <p className="text-sm text-sf-text-secondary">
            Portfolio settings form will be implemented in the next subtask.
          </p>
          <p className="text-xs text-sf-text-muted mt-2">
            This includes: bio, theme selection, social links, pinned posts, and more.
          </p>
        </div>
      </div>
    </div>
  );
}
