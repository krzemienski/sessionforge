"use client";

import { useParams } from "next/navigation";
import { Globe } from "lucide-react";
import { PortfolioSettingsForm } from "@/components/settings/portfolio-settings-form";

export default function PortfolioSettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Globe size={22} className="text-sf-accent" />
        <h1 className="text-2xl font-bold font-display">Portfolio Settings</h1>
      </div>

      <div className="max-w-3xl">
        <p className="text-sm text-sf-text-secondary mb-6">
          Configure your public portfolio page at{" "}
          <code className="font-code text-sf-accent">
            sessionforge.dev/p/{workspace}
          </code>
          {" "}to showcase your published content.
        </p>

        <PortfolioSettingsForm workspace={workspace} />
      </div>
    </div>
  );
}
