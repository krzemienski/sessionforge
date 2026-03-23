"use client";

import { useState } from "react";
import { X, Send, ExternalLink, AlertCircle, Check } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface HashnodePublishModalProps {
  postId: string;
  workspace: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (url: string) => void;
}

type ModalState = "form" | "loading" | "success" | "error";

export function HashnodePublishModal({
  postId,
  isOpen,
  onClose,
  onSuccess,
}: HashnodePublishModalProps) {
  const [tags, setTags] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");

  const [state, setState] = useState<ModalState>("form");
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const focusTrapRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen, onEscape: onClose });

  if (!isOpen) return null;

  function resetForm() {
    setTags("");
    setSubtitle("");
    setCoverImageUrl("");
    setSeoTitle("");
    setSeoDescription("");
    setCanonicalUrl("");
    setState("form");
    setPublishedUrl(null);
    setErrorMessage(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handlePublish() {
    setState("loading");
    setErrorMessage(null);

    const body: Record<string, unknown> = {};

    const trimmedTags = tags.trim();
    if (trimmedTags) {
      body.tags = trimmedTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (subtitle.trim()) body.subtitle = subtitle.trim();
    if (coverImageUrl.trim()) body.coverImageUrl = coverImageUrl.trim();
    if (seoTitle.trim()) body.seoTitle = seoTitle.trim();
    if (seoDescription.trim()) body.seoDescription = seoDescription.trim();
    if (canonicalUrl.trim()) body.canonicalUrl = canonicalUrl.trim();

    try {
      const res = await fetch(`/api/content/${postId}/publish/hashnode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? `Publish failed (${res.status})`);
      }

      setPublishedUrl(json.url);
      setState("success");
      onSuccess(json.url);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setState("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Modal */}
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Publish to Hashnode" className="relative w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sf-border">
          <div>
            <h2 className="text-base font-semibold text-sf-text-primary">
              Publish to Hashnode
            </h2>
            <p className="text-xs text-sf-text-muted mt-0.5">
              All fields are optional — configure your post before publishing.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-sf-text-muted hover:text-sf-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {state === "success" && publishedUrl ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-sf-success/10 border border-sf-success/30 rounded-sf p-4">
                <Check size={18} className="text-sf-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-sf-success">
                    Published successfully!
                  </p>
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sf-accent hover:underline flex items-center gap-1 mt-1"
                  >
                    {publishedUrl}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {state === "error" && errorMessage && (
                <div className="flex items-start gap-2 bg-sf-danger/10 border border-sf-danger/30 rounded-sf p-3">
                  <AlertCircle size={16} className="text-sf-danger mt-0.5 shrink-0" />
                  <p className="text-sm text-sf-danger">{errorMessage}</p>
                </div>
              )}

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                  Tags{" "}
                  <span className="font-normal text-sf-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. typescript, nextjs, webdev"
                  disabled={state === "loading"}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50"
                />
                <p className="text-xs text-sf-text-muted mt-1">
                  Comma-separated list of tag slugs.
                </p>
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                  Subtitle{" "}
                  <span className="font-normal text-sf-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="A brief subtitle for your post"
                  disabled={state === "loading"}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50"
                />
              </div>

              {/* Cover Image URL */}
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                  Cover Image URL{" "}
                  <span className="font-normal text-sf-text-muted">(optional)</span>
                </label>
                <input
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://example.com/cover.png"
                  disabled={state === "loading"}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus disabled:opacity-50"
                />
              </div>

              {/* SEO Title */}
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                  SEO Title{" "}
                  <span className="font-normal text-sf-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Override the default title for search engines"
                  disabled={state === "loading"}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50"
                />
              </div>

              {/* SEO Description */}
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                  SEO Description{" "}
                  <span className="font-normal text-sf-text-muted">(optional)</span>
                </label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="A short description for search engines (160 chars recommended)"
                  rows={2}
                  disabled={state === "loading"}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary resize-none focus:outline-none focus:border-sf-border-focus disabled:opacity-50"
                />
              </div>

              {/* Canonical URL */}
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                  Canonical URL{" "}
                  <span className="font-normal text-sf-text-muted">(optional)</span>
                </label>
                <input
                  type="url"
                  value={canonicalUrl}
                  onChange={(e) => setCanonicalUrl(e.target.value)}
                  placeholder="https://yourblog.com/my-post"
                  disabled={state === "loading"}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus disabled:opacity-50"
                />
                <p className="text-xs text-sf-text-muted mt-1">
                  Leave blank to use your workspace default canonical domain.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handlePublish}
                  disabled={state === "loading"}
                  className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                >
                  <Send size={15} />
                  {state === "loading" ? "Publishing..." : "Publish"}
                </button>
                <button
                  onClick={handleClose}
                  disabled={state === "loading"}
                  className="text-sm text-sf-text-muted hover:text-sf-text-primary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
