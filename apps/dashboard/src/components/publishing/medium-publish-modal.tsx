"use client";

import { useState, useEffect } from "react";
import { ExternalLink, X, Send, RefreshCw } from "lucide-react";
import { usePublishToMedium, useUpdateMediumPost } from "@/hooks/use-medium";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface MediumPublishModalProps {
  postId: string;
  workspace: string;
  isOpen: boolean;
  onClose: () => void;
  isAlreadyPublished: boolean;
  existingPublicationUrl?: string;
}

export function MediumPublishModal({
  postId,
  workspace,
  isOpen,
  onClose,
  isAlreadyPublished,
  existingPublicationUrl,
}: MediumPublishModalProps) {
  const [tags, setTags] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [publishStatus, setPublishStatus] = useState<"draft" | "public" | "unlisted">("draft");
  const [notifyFollowers, setNotifyFollowers] = useState(false);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const publish = usePublishToMedium();
  const update = useUpdateMediumPost();

  const isPending = publish.isPending || update.isPending;

  const focusTrapRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen, onEscape: onClose });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTags("");
      setCanonicalUrl("");
      setPublishStatus("draft");
      setNotifyFollowers(false);
      setSuccessUrl(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function parseTags(raw: string): string[] {
    return raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  async function handleSubmit() {
    setErrorMessage(null);
    const parsedTags = parseTags(tags);
    const payload = {
      postId,
      workspaceSlug: workspace,
      publishStatus: isAlreadyPublished ? undefined : publishStatus,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      canonicalUrl: canonicalUrl.trim() || undefined,
      notifyFollowers,
    };

    try {
      if (isAlreadyPublished) {
        await update.mutateAsync(payload);
        setSuccessUrl(existingPublicationUrl ?? null);
      } else {
        const result = await publish.mutateAsync(payload);
        setSuccessUrl(result.mediumUrl ?? null);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }

  const isSuccess = publish.isSuccess || update.isSuccess;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label={isAlreadyPublished ? "Update on Medium" : "Publish to Medium"} className="relative z-10 w-full max-w-md bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold font-display text-sf-text-primary">
            {isAlreadyPublished ? "Update on Medium" : "Publish to Medium"}
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
            <p className="text-sm text-sf-success font-medium">
              {isAlreadyPublished
                ? "Article updated on Medium successfully."
                : publishStatus === "draft"
                ? "Article saved as draft on Medium."
                : publishStatus === "unlisted"
                ? "Article published as unlisted on Medium."
                : "Article published to Medium successfully."}
            </p>
            {successUrl && (
              <a
                href={successUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                <ExternalLink size={14} />
                View on Medium
              </a>
            )}
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
          <div className="space-y-4">
            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Tags
                <span className="ml-1 text-sf-text-tertiary font-normal">(comma-separated, max 5)</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="typescript, webdev, tutorial"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus placeholder:text-sf-text-tertiary"
              />
            </div>

            {/* Canonical URL */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Canonical URL
                <span className="ml-1 text-sf-text-tertiary font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="https://yourblog.com/post-slug"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus placeholder:text-sf-text-tertiary"
              />
            </div>

            {/* Publish status — only relevant when not already published */}
            {!isAlreadyPublished && (
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                  Publish Status
                </label>
                <div className="flex gap-2">
                  {(["draft", "public", "unlisted"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setPublishStatus(status)}
                      className={`flex-1 px-3 py-1.5 rounded-sf text-sm font-medium border transition-colors capitalize ${
                        publishStatus === status
                          ? "bg-sf-accent text-sf-bg-primary border-sf-accent"
                          : "bg-sf-bg-tertiary text-sf-text-secondary border-sf-border hover:text-sf-text-primary"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notify followers toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNotifyFollowers(!notifyFollowers)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  notifyFollowers ? "bg-sf-accent" : "bg-sf-bg-tertiary border border-sf-border"
                }`}
                aria-label="Toggle notify followers"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    notifyFollowers ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-sf-text-primary">Notify followers</span>
            </div>

            {/* Error */}
            {errorMessage && (
              <p className="text-sm text-sf-error">{errorMessage}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-sf text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {isPending
                  ? isAlreadyPublished
                    ? "Updating..."
                    : "Publishing..."
                  : isAlreadyPublished
                  ? "Update"
                  : "Publish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
