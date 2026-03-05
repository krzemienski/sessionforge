"use client";

import { useParams, useRouter } from "next/navigation";
import { useSingleSeries, useUpdateSeries, useReorderSeriesPosts, useRemovePostFromSeries } from "@/hooks/use-series";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Save, GripVertical, X, Loader2, FileText } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

export default function SeriesDetailPage() {
  const { workspace, seriesId } = useParams<{ workspace: string; seriesId: string }>();
  const router = useRouter();
  const series = useSingleSeries(seriesId);
  const update = useUpdateSeries();
  const reorder = useReorderSeriesPosts();
  const removePost = useRemovePostFromSeries();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [postList, setPostList] = useState<any[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (series.data && !initializedRef.current) {
      setTitle(series.data.title || "");
      setDescription(series.data.description || "");
      setSlug(series.data.slug || "");
      setIsPublic(series.data.isPublic ?? false);
      // API returns seriesPosts with nested post objects
      const posts = series.data.seriesPosts?.map((sp: any) => sp.post) || [];
      setPostList(posts);
      initializedRef.current = true;
    }
  }, [series.data]);

  function handleSave() {
    update.mutate({ id: seriesId, title, description, slug, isPublic });
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newList = [...postList];
    const draggedItem = newList[draggedIndex];
    newList.splice(draggedIndex, 1);
    newList.splice(index, 0, draggedItem);
    setPostList(newList);
    setDraggedIndex(index);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    const postIds = postList.map((p) => p.id);
    reorder.mutate({ seriesId, postIds });
  }

  function handleRemovePost(postId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Remove this post from the series?")) return;

    removePost.mutate({ seriesId, postId }, {
      onSuccess: () => {
        setPostList((prev) => prev.filter((p) => p.id !== postId));
      },
    });
  }

  if (series.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-sf-text-muted" />
      </div>
    );
  }

  if (!series.data) {
    return (
      <div className="text-center py-12">
        <p className="text-sf-text-secondary">Series not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push(`/${workspace}/series`)}
          className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm"
        >
          <ArrowLeft size={16} /> Series
        </button>
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {update.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-sf-text-secondary mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
              placeholder="Series title..."
            />
          </div>

          <div>
            <label className="block text-sm text-sf-text-secondary mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary focus:outline-none focus:border-sf-border-focus resize-none"
              placeholder="Brief description of this series..."
            />
          </div>

          <div>
            <label className="block text-sm text-sf-text-secondary mb-2">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
              placeholder="series-slug"
            />
            <p className="text-xs text-sf-text-muted mt-1">
              Used in URLs and RSS feeds
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded-sf"
            />
            <label htmlFor="isPublic" className="text-sm text-sf-text-secondary">
              Make this series public
            </label>
          </div>
        </div>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-sf-text-primary">
            Posts in Series ({postList.length})
          </h2>
          <p className="text-xs text-sf-text-muted">
            Drag to reorder
          </p>
        </div>

        {postList.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sm text-sf-text-secondary">
              No posts in this series yet
            </p>
            <p className="text-xs text-sf-text-muted mt-1">
              Add posts from the content page
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {postList.map((post, index) => (
              <div
                key={post.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-3 bg-sf-bg-tertiary border border-sf-border rounded-sf p-3 cursor-move transition-all",
                  draggedIndex === index && "opacity-50",
                  "hover:border-sf-border-focus"
                )}
              >
                <div className="text-sf-text-muted">
                  <GripVertical size={16} />
                </div>
                <div className="flex-shrink-0 w-8 h-8 rounded-sf bg-sf-accent/10 flex items-center justify-center text-sf-accent font-semibold text-sm">
                  {index + 1}
                </div>
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => router.push(`/${workspace}/content/${post.id}`)}
                >
                  <h4 className="text-sm font-medium text-sf-text-primary hover:text-sf-accent transition-colors">
                    {post.title || "Untitled"}
                  </h4>
                  <p className="text-xs text-sf-text-muted">
                    {post.contentType?.replace(/_/g, " ")} • Updated {timeAgo(post.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleRemovePost(post.id, e)}
                  disabled={removePost.isPending}
                  className="text-sf-text-muted hover:text-sf-danger transition-colors disabled:opacity-50"
                  title="Remove from series"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-sf-text-muted">
        <p>
          Posts are displayed in order. Part 1 is at the top, followed by Part 2, etc.
        </p>
      </div>
    </div>
  );
}
