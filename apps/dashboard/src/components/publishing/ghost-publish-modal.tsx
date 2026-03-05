"use client";

import { useState, useEffect } from "react";
import { ExternalLink, X, Send, RefreshCw } from "lucide-react";
import { usePublishToGhost, useUpdateGhostPost } from "@/hooks/use-ghost";

type GhostVisibility = "public" | "members" | "paid";

interface GhostPublishModalProps {
  postId: string;
  workspace: string;
  isOpen: boolean;
  onClose: () => void;
  isAlreadyPublished: boolean;
  existingPublicationUrl?: string;
}

export function GhostPublishModal({
  postId,
  workspace,
  isOpen,
  onClose,
  isAlreadyPublished,
  existingPublicationUrl,
}: GhostPublishModalProps) {
  const [tags, setTags] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [visibility, setVisibility] = useState<GhostVisibility>("public");
  const [isDraft, setIsDraft] = useState(true);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const publish = usePublishToGhost();
  const update = useUpdateGhostPost();

  const isPending = publish.isPending || update.isPending;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTags("");
      setCanonicalUrl("");
      setFeaturedImage("");
      setVisibility("public");
      setIsDraft(true);
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
      status: isAlreadyPublished ? undefined : isDraft ? ("draft" as const) : ("published" as const),
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      canonicalUrl: canonicalUrl.trim() || undefined,
      featureImage: featuredImage.trim() || undefined,
      visibility,
    };

    try {
      if (isAlreadyPublished) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await update.mutateAsync(payload as any);
        setSuccessUrl(existingPublicationUrl ?? null);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await publish.mutateAsync(payload as any);
        setSuccessUrl(result.ghostUrl ?? null);
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
      <div className="relative z-10 w-full max-w-md bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold font-display text-sf-text-primary">
            {isAlreadyPublished ? "Update on Ghost" : "Publish to Ghost"}
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
                ? "Post updated on Ghost successfully."
                : isDraft
                ? "Post saved as draft on Ghost."
                : "Post published to Ghost successfully."}
            </p>
            {successUrl && (
              <a
                href={successUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                <ExternalLink size={14} />
                View on Ghost
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
            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as GhostVisibility)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
              >
                <option value="public">Public</option>
                <option value="members">Members only</option>
                <option value="paid">Paid members only</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Tags
                <span className="ml-1 text-sf-text-tertiary font-normal">(comma-separated)</span>
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

            {/* Featured Image */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Featured Image URL
                <span className="ml-1 text-sf-text-tertiary font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus placeholder:text-sf-text-tertiary"
              />
            </div>

            {/* Draft toggle — only relevant when not already published */}
            {!isAlreadyPublished && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsDraft(!isDraft)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    isDraft ? "bg-sf-accent" : "bg-sf-bg-tertiary border border-sf-border"
                  }`}
                  aria-label="Toggle draft mode"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      isDraft ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-sm text-sf-text-primary">Publish as draft</span>
              </div>
            )}

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
