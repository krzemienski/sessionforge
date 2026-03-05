"use client";

import { useState, useEffect } from "react";
import { Download, X, RefreshCw, Check, Globe, Palette } from "lucide-react";
import { useExportCollection } from "@/hooks/use-collections";
import { ThemeSelector, type ExportThemeId } from "./theme-selector";

type ThemeId = ExportThemeId;

interface StaticSiteExportModalProps {
  collectionId: string;
  collectionName: string;
  defaultTheme?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StaticSiteExportModal({
  collectionId,
  collectionName,
  defaultTheme,
  isOpen,
  onClose,
}: StaticSiteExportModalProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    (defaultTheme as ThemeId) ?? "technical-blog"
  );
  const [customDomain, setCustomDomain] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { exportCollection, isExporting } = useExportCollection();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTheme((defaultTheme as ThemeId) ?? "technical-blog");
      setCustomDomain("");
      setIsSuccess(false);
      setErrorMessage(null);
    }
  }, [isOpen, defaultTheme]);

  if (!isOpen) return null;

  async function handleExport() {
    setErrorMessage(null);
    try {
      await exportCollection(collectionId, collectionName, selectedTheme, customDomain || undefined);
      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold font-display text-sf-text-primary">
            Export Static Site
          </h2>
          <button
            onClick={onClose}
            className="text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {isSuccess ? (
          /* Success state */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-sf-success/10 flex items-center justify-center flex-shrink-0">
                <Check size={16} className="text-sf-success" />
              </div>
              <p className="text-sm text-sf-success font-medium">
                Static site exported successfully!
              </p>
            </div>
            <p className="text-sm text-sf-text-secondary">
              Your ZIP file is downloading. Extract it and open{" "}
              <code className="bg-sf-bg-tertiary px-1 py-0.5 rounded text-xs font-mono">
                index.html
              </code>{" "}
              to preview locally, or follow the deployment guide to publish to GitHub Pages.
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form state */
          <div className="space-y-5">
            {/* Collection info */}
            <div className="flex items-center gap-2 px-3 py-2 bg-sf-bg-tertiary rounded-sf border border-sf-border">
              <Download size={14} className="text-sf-text-muted flex-shrink-0" />
              <span className="text-sm text-sf-text-primary font-medium truncate">
                {collectionName}
              </span>
              <span className="ml-auto text-xs text-sf-text-muted flex-shrink-0">
                .zip
              </span>
            </div>

            {/* Theme selector */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-sf-text-secondary mb-2">
                <Palette size={13} />
                Theme
              </label>
              <ThemeSelector value={selectedTheme} onChange={setSelectedTheme} />
            </div>

            {/* Custom domain */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-sf-text-secondary mb-1">
                <Globe size={13} />
                Custom Domain
                <span className="ml-1 text-sf-text-tertiary font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="yourdomain.com"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-mono focus:outline-none focus:border-sf-border-focus placeholder:text-sf-text-tertiary"
              />
              <p className="mt-1 text-xs text-sf-text-muted">
                Adds a CNAME file to the export for GitHub Pages custom domain setup.
              </p>
            </div>

            {/* Error */}
            {errorMessage && (
              <p className="text-sm text-sf-error">{errorMessage}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={isExporting}
                className="px-4 py-2 rounded-sf text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
              >
                {isExporting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {isExporting ? "Exporting…" : "Export ZIP"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
