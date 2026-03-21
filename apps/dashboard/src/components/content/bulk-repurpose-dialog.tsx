"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Wand2, Check, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  title: string;
  contentType: string;
  status: string;
}

interface BulkRepurposeDialogProps {
  workspace: string;
  isOpen: boolean;
  onClose: () => void;
}

type TargetFormat =
  | "twitter_thread"
  | "linkedin_post"
  | "changelog"
  | "tldr"
  | "newsletter"
  | "doc_page";

const FORMAT_LABELS: Record<TargetFormat, string> = {
  twitter_thread: "Twitter Thread",
  linkedin_post: "LinkedIn Post",
  changelog: "Changelog Entry",
  tldr: "TL;DR Summary",
  newsletter: "Newsletter Section",
  doc_page: "Documentation Page",
};

const FORMAT_DESCRIPTIONS: Record<TargetFormat, string> = {
  twitter_thread: "Convert to an engaging Twitter thread",
  linkedin_post: "Transform into a professional LinkedIn post",
  changelog: "Create a concise changelog entry",
  tldr: "Generate a quick TL;DR summary",
  newsletter: "Adapt into a newsletter section for subscribers",
  doc_page: "Transform into a structured documentation page",
};

const ALL_FORMATS: TargetFormat[] = [
  "twitter_thread",
  "linkedin_post",
  "changelog",
  "tldr",
  "newsletter",
  "doc_page",
];

const MAX_POSTS = 20;

interface PostFormatResult {
  format: TargetFormat;
  success: boolean;
  postId?: string;
  error?: string;
}

interface PostResult {
  postId: string;
  formats: PostFormatResult[];
}

export function BulkRepurposeDialog({
  workspace,
  isOpen,
  onClose,
}: BulkRepurposeDialogProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [selectedFormats, setSelectedFormats] = useState<Set<TargetFormat>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [results, setResults] = useState<PostResult[]>([]);

  // Reset and load posts when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPostIds(new Set());
      setSelectedFormats(new Set());
      setIsProcessing(false);
      setErrorMessage(null);
      setIsComplete(false);
      setResults([]);
      loadPosts();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPosts() {
    setIsLoadingPosts(true);
    try {
      const sp = new URLSearchParams({ workspace, status: "published", type: "blog_post", limit: "50" });
      const res = await fetch(`/api/content?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      setErrorMessage("Failed to load posts. Please try again.");
    } finally {
      setIsLoadingPosts(false);
    }
  }

  if (!isOpen) return null;

  function togglePost(postId: string) {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        if (next.size >= MAX_POSTS) return prev;
        next.add(postId);
      }
      return next;
    });
  }

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
    if (selectedPostIds.size === 0) {
      setErrorMessage("Please select at least one post");
      return;
    }
    if (selectedFormats.size === 0) {
      setErrorMessage("Please select at least one format");
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const response = await fetch("/api/content/bulk-repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: workspace,
          postIds: Array.from(selectedPostIds),
          targetFormats: Array.from(selectedFormats),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Bulk repurpose failed");
      }

      setResults(data.results ?? []);
      setIsComplete(true);

      const totalSuccess = (data.results as PostResult[]).reduce(
        (acc: number, r: PostResult) => acc + r.formats.filter((f) => f.success).length,
        0
      );
      const totalErrors = (data.results as PostResult[]).reduce(
        (acc: number, r: PostResult) => acc + r.formats.filter((f) => !f.success).length,
        0
      );

      if (totalSuccess > 0) {
        showToast(
          `Successfully created ${totalSuccess} piece${totalSuccess > 1 ? "s" : ""} of content`,
          "success"
        );
      }
      if (totalErrors > 0) {
        showToast(
          `Failed to generate ${totalErrors} piece${totalErrors > 1 ? "s" : ""} of content`,
          "error"
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  }

  const totalSuccess = results.reduce(
    (acc, r) => acc + r.formats.filter((f) => f.success).length,
    0
  );
  const totalErrors = results.reduce(
    (acc, r) => acc + r.formats.filter((f) => !f.success).length,
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isProcessing ? undefined : onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-sf-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold font-display text-sf-text-primary">
              Bulk Repurpose Content
            </h2>
            <p className="text-sm text-sf-text-secondary mt-0.5">
              Select up to {MAX_POSTS} posts and choose target formats
            </p>
          </div>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isComplete ? (
            /* Results state */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    totalErrors === 0 ? "bg-sf-success/10" : "bg-amber-500/10"
                  )}
                >
                  {totalErrors === 0 ? (
                    <Check size={16} className="text-sf-success" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-500" />
                  )}
                </div>
                <p className="text-sm font-medium">
                  {totalErrors === 0 ? (
                    <span className="text-sf-success">Bulk repurpose complete!</span>
                  ) : (
                    <span className="text-amber-500">Partially completed</span>
                  )}
                </p>
              </div>

              {/* Summary counts */}
              <div className="text-sm text-sf-text-secondary space-y-1">
                {totalSuccess > 0 && (
                  <p>✓ Successfully created {totalSuccess} piece{totalSuccess > 1 ? "s" : ""} of content</p>
                )}
                {totalErrors > 0 && (
                  <p>✗ Failed to generate {totalErrors} piece{totalErrors > 1 ? "s" : ""} of content</p>
                )}
              </div>

              {/* Per-post breakdown */}
              {results.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h3 className="text-sm font-medium text-sf-text-secondary">Results by post</h3>
                  <div className="space-y-2">
                    {results.map((result) => {
                      const post = posts.find((p) => p.id === result.postId);
                      const postSuccess = result.formats.filter((f) => f.success).length;
                      const postErrors = result.formats.filter((f) => !f.success).length;
                      return (
                        <div
                          key={result.postId}
                          className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-3"
                        >
                          <p className="text-sm font-medium text-sf-text-primary truncate">
                            {post?.title ?? result.postId}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {result.formats.map((f) => (
                              <span
                                key={f.format}
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                                  f.success
                                    ? "bg-sf-success/10 text-sf-success"
                                    : "bg-sf-error/10 text-sf-error"
                                )}
                              >
                                {f.success ? <Check size={10} /> : <AlertCircle size={10} />}
                                {FORMAT_LABELS[f.format]}
                              </span>
                            ))}
                          </div>
                          {postErrors > 0 && (
                            <p className="text-xs text-sf-text-tertiary mt-1">
                              {postErrors} format{postErrors > 1 ? "s" : ""} failed
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : isProcessing ? (
            /* Processing state */
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-10 h-10 border-2 border-sf-accent/20 border-t-sf-accent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-sf-text-primary">
                  Processing {selectedPostIds.size} post{selectedPostIds.size > 1 ? "s" : ""}...
                </p>
                <p className="text-xs text-sf-text-secondary mt-1">
                  Generating {selectedFormats.size} format{selectedFormats.size > 1 ? "s" : ""} per post. This may take a moment.
                </p>
              </div>
            </div>
          ) : (
            /* Form state */
            <div className="grid grid-cols-2 gap-6">
              {/* Post Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-sf-text-secondary">
                    Select Posts
                  </label>
                  <span
                    className={cn(
                      "text-xs",
                      selectedPostIds.size >= MAX_POSTS
                        ? "text-amber-500 font-medium"
                        : "text-sf-text-tertiary"
                    )}
                  >
                    {selectedPostIds.size}/{MAX_POSTS}
                  </span>
                </div>

                {isLoadingPosts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={18} className="animate-spin text-sf-text-tertiary" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-4 text-center">
                    <p className="text-sm text-sf-text-secondary">No published blog posts found</p>
                    <p className="text-xs text-sf-text-tertiary mt-1">
                      Publish a blog post first to bulk repurpose
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {posts.map((post) => {
                      const isSelected = selectedPostIds.has(post.id);
                      const isDisabled = !isSelected && selectedPostIds.size >= MAX_POSTS;
                      return (
                        <label
                          key={post.id}
                          className={cn(
                            "flex items-start gap-2.5 p-2.5 rounded-sf border transition-all",
                            isSelected
                              ? "bg-sf-accent/5 border-sf-accent"
                              : isDisabled
                              ? "bg-sf-bg-tertiary border-sf-border opacity-50 cursor-not-allowed"
                              : "bg-sf-bg-tertiary border-sf-border hover:border-sf-border-strong cursor-pointer"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => !isDisabled && togglePost(post.id)}
                            disabled={isDisabled}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-sf-border text-sf-accent focus:ring-1 focus:ring-sf-accent focus:ring-offset-0 disabled:opacity-50 shrink-0"
                          />
                          <span className="text-xs text-sf-text-primary line-clamp-2 leading-snug">
                            {post.title || "Untitled Post"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {selectedPostIds.size >= MAX_POSTS && (
                  <p className="text-xs text-amber-500">
                    Maximum of {MAX_POSTS} posts selected
                  </p>
                )}
              </div>

              {/* Format Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-sf-text-secondary">
                  Select Formats
                </label>
                <div className="space-y-1.5">
                  {ALL_FORMATS.map((format) => (
                    <label
                      key={format}
                      className={cn(
                        "flex items-start gap-2.5 p-2.5 rounded-sf border transition-all cursor-pointer",
                        selectedFormats.has(format)
                          ? "bg-sf-accent/5 border-sf-accent"
                          : "bg-sf-bg-tertiary border-sf-border hover:border-sf-border-strong"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFormats.has(format)}
                        onChange={() => toggleFormat(format)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-sf-border text-sf-accent focus:ring-1 focus:ring-sf-accent focus:ring-offset-0 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-sf-text-primary">
                          {FORMAT_LABELS[format]}
                        </div>
                        <div className="text-xs text-sf-text-tertiary mt-0.5 leading-snug">
                          {FORMAT_DESCRIPTIONS[format]}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && !isComplete && !isProcessing && (
            <div className="mt-4 bg-sf-error/10 border border-sf-error/20 rounded-sf p-3 text-sm text-sf-error">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sf-border shrink-0">
          {isComplete ? (
            <div className="flex items-center justify-between">
              {totalSuccess > 0 && (
                <Link
                  href={`/${workspace}/content`}
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-sm font-medium text-sf-accent hover:text-sf-accent-dim transition-colors"
                >
                  <ExternalLink size={14} />
                  View Generated Content
                </Link>
              )}
              <button
                onClick={onClose}
                className={cn(
                  "bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors",
                  totalSuccess === 0 && "ml-auto"
                )}
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-xs text-sf-text-tertiary">
                {selectedPostIds.size > 0 && selectedFormats.size > 0 && (
                  <>
                    Will generate{" "}
                    <span className="font-medium text-sf-text-secondary">
                      {selectedPostIds.size * selectedFormats.size}
                    </span>{" "}
                    piece{selectedPostIds.size * selectedFormats.size > 1 ? "s" : ""} of content
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
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
                  disabled={
                    isProcessing ||
                    selectedPostIds.size === 0 ||
                    selectedFormats.size === 0 ||
                    isLoadingPosts
                  }
                  className={cn(
                    "flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors",
                    (isProcessing ||
                      selectedPostIds.size === 0 ||
                      selectedFormats.size === 0 ||
                      isLoadingPosts) &&
                      "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Wand2 size={14} />
                  Repurpose ({selectedPostIds.size} × {selectedFormats.size})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
