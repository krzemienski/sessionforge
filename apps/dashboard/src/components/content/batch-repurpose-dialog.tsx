"use client";

import { useState, useEffect } from "react";
import { X, Wand2, Check, AlertCircle } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface BatchRepurposeDialogProps {
  postId: string;
  workspace: string;
  contentType: string;
  isOpen: boolean;
  onClose: () => void;
}

type TargetFormat = "twitter_thread" | "linkedin_post" | "changelog" | "tldr" | "blog_post";

const FORMAT_LABELS: Record<TargetFormat, string> = {
  twitter_thread: "Twitter Thread",
  linkedin_post: "LinkedIn Post",
  changelog: "Changelog Entry",
  tldr: "TL;DR Summary",
  blog_post: "Blog Post",
};

const FORMAT_DESCRIPTIONS: Record<TargetFormat, string> = {
  twitter_thread: "Convert to an engaging Twitter thread",
  linkedin_post: "Transform into a professional LinkedIn post",
  changelog: "Create a concise changelog entry",
  tldr: "Generate a quick TL;DR summary",
  blog_post: "Expand into a detailed blog post",
};

/**
 * Get available formats based on source content type
 */
function getAvailableFormats(contentType: string): TargetFormat[] {
  // Social posts can be expanded to blog posts
  if (contentType === "twitter_thread" || contentType === "linkedin_post") {
    return ["blog_post"];
  }

  // Blog posts can be repurposed to social formats
  if (contentType === "blog_post") {
    return ["twitter_thread", "linkedin_post", "changelog", "tldr"];
  }

  // Changelog can be repurposed to social
  if (contentType === "changelog") {
    return ["twitter_thread", "linkedin_post", "tldr"];
  }

  // Default: allow all social formats
  return ["twitter_thread", "linkedin_post", "changelog", "tldr"];
}

export function BatchRepurposeDialog({
  postId,
  workspace,
  contentType,
  isOpen,
  onClose,
}: BatchRepurposeDialogProps) {
  const [selectedFormats, setSelectedFormats] = useState<Set<TargetFormat>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const availableFormats = getAvailableFormats(contentType);

  const focusTrapRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen, onEscape: isProcessing ? undefined : onClose });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedFormats(new Set());
      setIsProcessing(false);
      setSuccessCount(0);
      setErrorCount(0);
      setErrorMessage(null);
      setIsComplete(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function toggleFormat(format: TargetFormat) {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (selectedFormats.size === 0) {
      setErrorMessage("Please select at least one format");
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setSuccessCount(0);
    setErrorCount(0);

    const formats = Array.from(selectedFormats);
    const results = await Promise.allSettled(
      formats.map(async (targetFormat) => {
        const response = await fetch(`/api/agents/repurpose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceSlug: workspace,
            sourcePostId: postId,
            targetFormat,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Repurpose failed");
        }

        // Wait for stream to complete
        const reader = response.body?.getReader();
        if (reader) {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }

        return targetFormat;
      })
    );

    // Count successes and failures
    let success = 0;
    let errors = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        success++;
      } else {
        errors++;
      }
    }

    setSuccessCount(success);
    setErrorCount(errors);
    setIsProcessing(false);
    setIsComplete(true);

    if (success > 0) {
      showToast(
        `Successfully repurposed content to ${success} format${success > 1 ? "s" : ""}`,
        "success"
      );

      // Reload after a short delay to show the new posts
      setTimeout(() => window.location.reload(), 1500);
    }

    if (errors > 0) {
      showToast(
        `Failed to repurpose to ${errors} format${errors > 1 ? "s" : ""}`,
        "error"
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isProcessing ? undefined : onClose}
      />

      {/* Panel */}
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Batch repurpose content" className="relative z-10 w-full max-w-md bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold font-display text-sf-text-primary">
            Batch Repurpose Content
          </h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className={cn(
              "text-sf-text-secondary hover:text-sf-text-primary transition-colors",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {isComplete ? (
          /* Success/Complete state */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  errorCount === 0 ? "bg-sf-success/10" : "bg-amber-500/10"
                )}
              >
                {errorCount === 0 ? (
                  <Check size={16} className="text-sf-success" />
                ) : (
                  <AlertCircle size={16} className="text-amber-500" />
                )}
              </div>
              <p className="text-sm font-medium">
                {errorCount === 0 ? (
                  <span className="text-sf-success">Batch repurpose complete!</span>
                ) : (
                  <span className="text-amber-500">Partially completed</span>
                )}
              </p>
            </div>
            <div className="text-sm text-sf-text-secondary space-y-1">
              {successCount > 0 && (
                <p>
                  ✓ Successfully created {successCount} format{successCount > 1 ? "s" : ""}
                </p>
              )}
              {errorCount > 0 && (
                <p>
                  ✗ Failed to create {errorCount} format{errorCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
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
            {/* Info */}
            <p className="text-sm text-sf-text-secondary">
              Select multiple formats to repurpose this content into. Each format will be
              generated as a separate post.
            </p>

            {/* Format Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-sf-text-secondary mb-2">
                Select Formats
              </label>
              <div className="space-y-2">
                {availableFormats.map((format) => (
                  <label
                    key={format}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-sf border transition-all cursor-pointer",
                      selectedFormats.has(format)
                        ? "bg-sf-accent/5 border-sf-accent"
                        : "bg-sf-bg-tertiary border-sf-border hover:border-sf-border-strong"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFormats.has(format)}
                      onChange={() => toggleFormat(format)}
                      disabled={isProcessing}
                      className="mt-0.5 h-4 w-4 rounded border-sf-border text-sf-accent focus:ring-2 focus:ring-sf-accent focus:ring-offset-0 disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-sf-text-primary">
                        {FORMAT_LABELS[format]}
                      </div>
                      <div className="text-xs text-sf-text-secondary mt-0.5">
                        {FORMAT_DESCRIPTIONS[format]}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-sf-error/10 border border-sf-error/20 rounded-sf p-3 text-sm text-sf-error">
                {errorMessage}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className={cn(
                  "px-4 py-2 text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary transition-colors",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isProcessing || selectedFormats.size === 0}
                className={cn(
                  "flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors",
                  (isProcessing || selectedFormats.size === 0) &&
                    "opacity-50 cursor-not-allowed"
                )}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-sf-bg-primary/30 border-t-sf-bg-primary rounded-full animate-spin" />
                    Repurposing...
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    Repurpose ({selectedFormats.size})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
