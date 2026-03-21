"use client";

import { useState, useRef, useEffect } from "react";
import { X, Globe, Archive, Download, BookOpen, ChevronDown, Loader2 } from "lucide-react";
import { usePublishPostsBatch, useArchivePostsBatch } from "@/hooks/use-batch-operations";
import { useSeries } from "@/hooks/use-series";
import { useAddPostToSeries } from "@/hooks/use-series";

interface Post {
  id: string;
  title: string;
  contentType: string;
  publishedAt: Date | null;
  createdAt: Date;
  metaDescription: string | null;
  wordCount: number | null;
  status: string;
}

interface BulkOperationsBarProps {
  selectedCount: number;
  selectedPostIds: string[];
  selectedPosts: Post[];
  workspaceSlug: string;
  onClearSelection: () => void;
}

export function BulkOperationsBar({
  selectedCount,
  selectedPostIds,
  selectedPosts,
  workspaceSlug,
  onClearSelection,
}: BulkOperationsBarProps) {
  const [showSeriesPicker, setShowSeriesPicker] = useState(false);
  const [seriesSuccess, setSeriesSuccess] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const seriesPickerRef = useRef<HTMLDivElement>(null);

  const publishBatch = usePublishPostsBatch(workspaceSlug);
  const archiveBatch = useArchivePostsBatch(workspaceSlug);
  const addPostToSeries = useAddPostToSeries();
  const { data: seriesData } = useSeries(workspaceSlug);

  const seriesList: Array<{ id: string; title: string }> = seriesData?.series ?? seriesData ?? [];

  // Close series picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        seriesPickerRef.current &&
        !seriesPickerRef.current.contains(event.target as Node)
      ) {
        setShowSeriesPicker(false);
      }
    }
    if (showSeriesPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSeriesPicker]);

  function showSuccessMessage(message: string) {
    setActionSuccess(message);
    setTimeout(() => setActionSuccess(null), 3000);
  }

  async function handlePublish() {
    try {
      await publishBatch.mutateAsync(selectedPostIds);
      showSuccessMessage(`Published ${selectedCount} post${selectedCount !== 1 ? "s" : ""}`);
      onClearSelection();
    } catch {
      // error is surfaced via mutation state
    }
  }

  async function handleArchive() {
    try {
      await archiveBatch.mutateAsync(selectedPostIds);
      showSuccessMessage(`Archived ${selectedCount} post${selectedCount !== 1 ? "s" : ""}`);
      onClearSelection();
    } catch {
      // error is surfaced via mutation state
    }
  }

  function handleExport() {
    const data = selectedPosts.map((post) => ({
      id: post.id,
      title: post.title,
      contentType: post.contentType,
      status: post.status,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      metaDescription: post.metaDescription,
      wordCount: post.wordCount,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `posts-export-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showSuccessMessage(`Exported ${selectedCount} post${selectedCount !== 1 ? "s" : ""}`);
  }

  async function handleAddToSeries(seriesId: string, seriesTitle: string) {
    setShowSeriesPicker(false);
    try {
      await Promise.all(
        selectedPostIds.map((postId, index) =>
          addPostToSeries.mutateAsync({ seriesId, postId, position: index })
        )
      );
      setSeriesSuccess(
        `Added ${selectedCount} post${selectedCount !== 1 ? "s" : ""} to "${seriesTitle}"`
      );
      setTimeout(() => setSeriesSuccess(null), 3000);
      onClearSelection();
    } catch {
      // error is surfaced via mutation state
    }
  }

  const isLoading =
    publishBatch.isPending || archiveBatch.isPending || addPostToSeries.isPending;
  const hasError =
    publishBatch.isError || archiveBatch.isError || addPostToSeries.isError;

  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-4 pointer-events-none"
      role="toolbar"
      aria-label="Bulk operations"
    >
      <div className="pointer-events-auto w-full max-w-3xl bg-sf-bg-primary border border-sf-border rounded-sf-lg shadow-lg px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Selection count + clear */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium text-sf-text-primary">
            {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-sf-text-muted hover:text-sf-text-primary transition-colors"
            aria-label="Clear selection"
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-sf-border shrink-0" />

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sf-accent text-white rounded-sf hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {publishBatch.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Globe size={14} />
            )}
            Publish
          </button>

          {/* Archive */}
          <button
            onClick={handleArchive}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sf-bg-secondary border border-sf-border text-sf-text-primary rounded-sf hover:border-sf-accent hover:text-sf-accent disabled:opacity-50 transition-colors"
          >
            {archiveBatch.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Archive size={14} />
            )}
            Archive
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sf-bg-secondary border border-sf-border text-sf-text-primary rounded-sf hover:border-sf-accent hover:text-sf-accent disabled:opacity-50 transition-colors"
          >
            <Download size={14} />
            Export
          </button>

          {/* Add to Series */}
          <div className="relative" ref={seriesPickerRef}>
            <button
              onClick={() => setShowSeriesPicker((prev) => !prev)}
              disabled={isLoading || seriesList.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sf-bg-secondary border border-sf-border text-sf-text-primary rounded-sf hover:border-sf-accent hover:text-sf-accent disabled:opacity-50 transition-colors"
              title={seriesList.length === 0 ? "No series available" : undefined}
            >
              {addPostToSeries.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <BookOpen size={14} />
              )}
              Add to Series
              <ChevronDown
                size={12}
                className={`transition-transform ${showSeriesPicker ? "rotate-180" : ""}`}
              />
            </button>

            {showSeriesPicker && seriesList.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 min-w-[180px] bg-sf-bg-primary border border-sf-border rounded-sf shadow-lg overflow-hidden z-10">
                {seriesList.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleAddToSeries(s.id, s.title)}
                    className="w-full text-left px-3 py-2 text-sm text-sf-text-primary hover:bg-sf-bg-secondary hover:text-sf-accent transition-colors"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status messages */}
        {(actionSuccess || seriesSuccess) && (
          <span className="text-sm text-green-500 sm:ml-auto">
            {actionSuccess ?? seriesSuccess}
          </span>
        )}
        {hasError && (
          <span className="text-sm text-red-400 sm:ml-auto">
            {publishBatch.isError
              ? "Failed to publish posts"
              : archiveBatch.isError
              ? "Failed to archive posts"
              : "Failed to add posts to series"}
          </span>
        )}
      </div>
    </div>
  );
}
