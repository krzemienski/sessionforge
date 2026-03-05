"use client";

import { useState, useMemo } from "react";
import { FileText } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { useContent, useUpdatePost } from "@/hooks/use-content";

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

interface PipelineViewProps {
  workspace: string;
  onNavigateToPost: (postId: string) => void;
}

export function PipelineView({ workspace, onNavigateToPost }: PipelineViewProps) {
  const content = useContent(workspace, { limit: 100 });
  const updatePost = useUpdatePost();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const posts = useMemo(() => {
    const list = content.data?.posts ?? [];
    return list.filter((p: any) => p.status !== "archived");
  }, [content.data]);

  const byStatus = useMemo(() => {
    const groups: Record<string, any[]> = { idea: [], draft: [], in_review: [], published: [] };
    for (const post of posts) {
      if (post.status in groups) {
        groups[post.status].push(post);
      }
    }
    return groups;
  }, [posts]);

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
    // Only clear if leaving the column entirely (not entering a child element)
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

  if (content.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-sf-text-muted">Loading pipeline...</p>
      </div>
    );
  }

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
              {colPosts.map((post: any) => (
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
                </div>
              ))}

              {colPosts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText size={24} className="text-sf-text-muted/40 mb-2" />
                  <p className="text-xs text-sf-text-muted">
                    No {col.label.toLowerCase()} content
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
