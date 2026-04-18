"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { FileText } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { useContent, useUpdatePost } from "@/hooks/use-content";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { ContentListItem } from "@/types/content";

const TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog Post",
  twitter_thread: "Twitter Thread",
  linkedin_post: "LinkedIn Post",
  changelog: "Changelog",
  newsletter: "Newsletter",
  devto_post: "Dev.to Post",
  custom: "Custom",
};

interface Column {
  status: string;
  label: string;
  headerClass: string;
  dotClass: string;
}

const COLUMNS: Column[] = [
  { status: "idea", label: "Idea", headerClass: "text-sf-text-muted", dotClass: "bg-sf-text-muted" },
  { status: "draft", label: "Draft", headerClass: "text-sf-info", dotClass: "bg-sf-info" },
  { status: "in_review", label: "In Review", headerClass: "text-sf-warning", dotClass: "bg-sf-warning" },
  { status: "published", label: "Published", headerClass: "text-sf-success", dotClass: "bg-sf-success" },
];

const LONG_PRESS_DURATION = 500; // ms

interface PipelineViewProps {
  workspace: string;
  onNavigateToPost: (postId: string) => void;
}

export function PipelineView({ workspace, onNavigateToPost }: PipelineViewProps) {
  const content = useContent(workspace, { limit: 100 });
  const updatePost = useUpdatePost();

  // Desktop drag-and-drop state
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{ id: string; title: string; currentStatus: string } | null>(null);

  // Long-press refs
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Scroll container ref for mobile snap
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Detect mobile breakpoint (matches Tailwind md: 768px)
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Track scroll position to update active column indicator
  useEffect(() => {
    if (!isMobile || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const columnWidth = container.clientWidth;
      const index = Math.round(scrollLeft / columnWidth);
      setActiveColumnIndex(Math.min(Math.max(0, index), COLUMNS.length - 1));
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  const posts = useMemo<ContentListItem[]>(() => {
    const list = (content.data?.posts ?? []) as ContentListItem[];
    return list.filter((p) => p.status !== "archived");
  }, [content.data]);

  const byStatus = useMemo(() => {
    const groups: Record<string, ContentListItem[]> = {
      idea: [],
      draft: [],
      in_review: [],
      published: [],
    };
    for (const post of posts) {
      if (post.status && post.status in groups) {
        groups[post.status].push(post);
      }
    }
    return groups;
  }, [posts]);

  // --- Desktop drag-and-drop handlers ---
  function handleDragStart(e: React.DragEvent, postId: string) {
    e.dataTransfer.setData("text/plain", postId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(postId);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  }

  function handleDragLeave(e: React.DragEvent) {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  }

  function handleDrop(e: React.DragEvent, targetStatus: string) {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggingId(null);
    const postId = e.dataTransfer.getData("text/plain");
    if (!postId) return;
    updatePost.mutate({ id: postId, status: targetStatus });
  }

  // --- Mobile long-press handlers ---
  const handleLongPressStart = useCallback((post: { id: string; title: string; status: string }) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setSelectedPost({ id: post.id, title: post.title, currentStatus: post.status });
      setBottomSheetOpen(true);
    }, LONG_PRESS_DURATION);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMoveToColumn = useCallback((targetStatus: string) => {
    if (!selectedPost) return;
    if (targetStatus !== selectedPost.currentStatus) {
      updatePost.mutate({ id: selectedPost.id, status: targetStatus });
    }
    setBottomSheetOpen(false);
    setSelectedPost(null);
  }, [selectedPost, updatePost]);

  const handleCardClick = useCallback((postId: string) => {
    // Don't navigate if long-press was triggered
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onNavigateToPost(postId);
  }, [onNavigateToPost]);

  // Scroll to column when tapping indicator dot
  const scrollToColumn = useCallback((index: number) => {
    if (!scrollContainerRef.current) return;
    const columnWidth = scrollContainerRef.current.clientWidth;
    scrollContainerRef.current.scrollTo({
      left: columnWidth * index,
      behavior: "smooth",
    });
  }, []);

  if (content.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-sf-text-muted">Loading pipeline...</p>
      </div>
    );
  }

  // --- Shared post card content ---
  function renderCardContent(post: ContentListItem) {
    return (
      <>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-sf-bg-tertiary rounded-sf-full text-xs text-sf-text-secondary truncate max-w-[120px]">
            {TYPE_LABELS[post.contentType] || post.contentType}
          </span>
          <span className="ml-auto text-xs text-sf-text-muted flex-shrink-0">
            {post.updatedAt ? timeAgo(post.updatedAt) : ""}
          </span>
        </div>
        <h4 className="text-sm font-semibold text-sf-text-primary line-clamp-2 mb-1">
          {post.title}
        </h4>
        {post.wordCount != null && (
          <p className="text-xs text-sf-text-muted">{post.wordCount} words</p>
        )}
      </>
    );
  }

  function renderEmptyColumn(col: Column) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FileText size={24} className="text-sf-text-muted/40 mb-2" />
        <p className="text-xs text-sf-text-muted">
          No {col.label.toLowerCase()} content
        </p>
      </div>
    );
  }

  // --- Mobile layout ---
  if (isMobile) {
    return (
      <>
        {/* Scroll-snap container: each column takes full viewport width */}
        <div
          ref={scrollContainerRef}
          className="sf-snap-x sf-touch-pan-x -mx-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex" style={{ width: `${COLUMNS.length * 100}%` }}>
            {COLUMNS.map((col) => {
              const colPosts = byStatus[col.status] ?? [];

              return (
                <div
                  key={col.status}
                  className="sf-snap-start sf-snap-stop flex flex-col px-4"
                  style={{ width: `${100 / COLUMNS.length}%` }}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", col.dotClass)} />
                    <span className={cn("text-sm font-semibold", col.headerClass)}>
                      {col.label}
                    </span>
                    <span className="ml-auto text-xs text-sf-text-muted bg-sf-bg-tertiary px-1.5 py-0.5 rounded-sf-full">
                      {colPosts.length}
                    </span>
                  </div>

                  {/* Column content */}
                  <div className="flex-1 min-h-[200px] rounded-sf-lg p-2 space-y-2 bg-sf-bg-tertiary/40 border border-transparent">
                    {colPosts.map((post) => (
                      <div
                        key={post.id}
                        onTouchStart={() =>
                          handleLongPressStart({
                            id: post.id,
                            title: post.title ?? "",
                            status: post.status ?? "",
                          })
                        }
                        onTouchEnd={handleLongPressEnd}
                        onTouchCancel={handleLongPressEnd}
                        onClick={() => handleCardClick(post.id)}
                        className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf p-3 cursor-pointer transition-colors select-none min-h-[44px]"
                      >
                        {renderCardContent(post)}
                      </div>
                    ))}
                    {colPosts.length === 0 && renderEmptyColumn(col)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scroll indicator dots */}
        <div className="flex items-center justify-center gap-2 mt-3 pb-2">
          {COLUMNS.map((col, i) => (
            <button
              key={col.status}
              onClick={() => scrollToColumn(i)}
              aria-label={`Go to ${col.label} column`}
              className={cn(
                "h-2 rounded-full transition-all duration-200",
                i === activeColumnIndex
                  ? cn("w-4", col.dotClass)
                  : "w-2 bg-sf-text-muted/30"
              )}
            />
          ))}
        </div>

        {/* Bottom sheet for moving posts between columns */}
        <BottomSheet
          isOpen={bottomSheetOpen}
          onClose={() => {
            setBottomSheetOpen(false);
            setSelectedPost(null);
          }}
          title={selectedPost?.title ? `Move "${selectedPost.title}"` : "Move post"}
          snapPoints={[0.4]}
        >
          <div className="space-y-1">
            {COLUMNS.map((col) => {
              const isCurrent = selectedPost?.currentStatus === col.status;
              return (
                <button
                  key={col.status}
                  onClick={() => handleMoveToColumn(col.status)}
                  disabled={isCurrent}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-sf text-left transition-colors min-h-[44px]",
                    isCurrent
                      ? "bg-sf-accent-bg text-sf-accent cursor-default"
                      : "text-sf-text-primary hover:bg-sf-bg-tertiary active:bg-sf-bg-tertiary"
                  )}
                >
                  <span className={cn("w-3 h-3 rounded-full flex-shrink-0", col.dotClass)} />
                  <span className="text-sm font-medium">{col.label}</span>
                  {isCurrent && (
                    <span className="ml-auto text-xs text-sf-text-muted">Current</span>
                  )}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </>
    );
  }

  // --- Desktop layout (unchanged) ---
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colPosts = byStatus[col.status] ?? [];
        const isOver = dragOverColumn === col.status;

        return (
          <div key={col.status} className="flex-shrink-0 w-64 flex flex-col">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", col.dotClass)} />
              <span className={cn("text-sm font-semibold", col.headerClass)}>
                {col.label}
              </span>
              <span className="ml-auto text-xs text-sf-text-muted bg-sf-bg-tertiary px-1.5 py-0.5 rounded-sf-full">
                {colPosts.length}
              </span>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
              className={cn(
                "flex-1 min-h-[200px] rounded-sf-lg p-2 space-y-2 transition-colors",
                isOver
                  ? "bg-sf-accent-bg border border-sf-accent/30"
                  : "bg-sf-bg-tertiary/40 border border-transparent"
              )}
            >
              {colPosts.map((post) => (
                <div
                  key={post.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, post.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onNavigateToPost(post.id)}
                  className={cn(
                    "bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf p-3 cursor-pointer transition-colors select-none",
                    draggingId === post.id && "opacity-50"
                  )}
                >
                  {renderCardContent(post)}
                </div>
              ))}

              {colPosts.length === 0 && renderEmptyColumn(col)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
