"use client";

import { Copy, ExternalLink, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/toast";

interface AuthenticityBadgeProps {
  postId: string;
  badgeEnabled: boolean;
  platformFooterEnabled: boolean;
  onBadgeToggle: (value: boolean) => void;
  onFooterToggle: (value: boolean) => void;
}

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent",
        checked ? "bg-sf-accent" : "bg-sf-bg-tertiary"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function AuthenticityBadge({
  postId,
  badgeEnabled,
  platformFooterEnabled,
  onBadgeToggle,
  onFooterToggle,
}: AuthenticityBadgeProps) {
  const badgeImageUrl = `/api/badge/${postId}`;
  const verificationUrl = `/api/content/${postId}/attribution`;
  const markdownSnippet = `[![Forged by SessionForge](${badgeImageUrl})](${verificationUrl})`;

  function handleCopySnippet() {
    navigator.clipboard
      .writeText(markdownSnippet)
      .then(() => showToast("Badge snippet copied to clipboard", "success"))
      .catch(() => showToast("Failed to copy snippet", "error"));
  }

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={14} className="text-sf-accent flex-shrink-0" />
        <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          Authenticity
        </h3>
      </div>

      {/* Badge toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="badge-toggle"
            className="text-sm text-sf-text-secondary cursor-pointer select-none"
          >
            Forged by SessionForge badge
          </label>
          <Toggle
            id="badge-toggle"
            checked={badgeEnabled}
            onChange={onBadgeToggle}
          />
        </div>

        {badgeEnabled && (
          <div className="space-y-2">
            {/* Badge preview */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeImageUrl}
              alt="Forged by SessionForge badge"
              className="h-7 rounded"
            />

            {/* Markdown snippet */}
            <div className="flex items-center gap-2">
              <code className="flex-1 font-code text-xs bg-sf-bg-tertiary border border-sf-border rounded px-2 py-1.5 text-sf-text-secondary truncate">
                {markdownSnippet}
              </code>
              <button
                onClick={handleCopySnippet}
                className="flex-shrink-0 p-1.5 rounded text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors"
                aria-label="Copy markdown snippet"
              >
                <Copy size={13} />
              </button>
            </div>

            {/* Verification link */}
            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-sf-text-muted hover:text-sf-accent transition-colors"
            >
              <ExternalLink size={11} />
              View verification data
            </a>
          </div>
        )}
      </div>

      {/* Platform footer toggle */}
      <div className="space-y-3 pt-1 border-t border-sf-border">
        <div className="flex items-center justify-between gap-3 pt-3">
          <label
            htmlFor="footer-toggle"
            className="text-sm text-sf-text-secondary cursor-pointer select-none"
          >
            Attribution footer (exports)
          </label>
          <Toggle
            id="footer-toggle"
            checked={platformFooterEnabled}
            onChange={onFooterToggle}
          />
        </div>

        {platformFooterEnabled && (
          <p className="text-xs text-sf-text-muted italic border-l-2 border-sf-border pl-2">
            This post was forged from a real coding session. Verified by
            SessionForge.
          </p>
        )}
      </div>
    </div>
  );
}
