"use client";

import { useParams, useRouter } from "next/navigation";
import { useSeries, useCreateSeries, useDeleteSeries } from "@/hooks/use-series";
import { useState } from "react";
import { BookOpen, Plus, X, Trash2, Loader2 } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

export default function SeriesPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const seriesData = useSeries(workspace, { limit: 50 });
  const seriesList = seriesData.data?.series ?? [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createIsPublic, setCreateIsPublic] = useState(false);

  const createSeries = useCreateSeries();
  const deleteSeries = useDeleteSeries();

  const handleCreate = async () => {
    if (!createTitle || !createSlug) return;

    try {
      await createSeries.mutateAsync({
        workspace,
        title: createTitle,
        description: createDescription || undefined,
        slug: createSlug,
        isPublic: createIsPublic,
      });
      setShowCreateModal(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateSlug("");
      setCreateIsPublic(false);
    } catch (error) {
      console.error("Failed to create series:", error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this series? Posts will not be deleted.")) return;

    try {
      await deleteSeries.mutateAsync(id);
    } catch (error) {
      console.error("Failed to delete series:", error);
    }
  };

  // Auto-generate slug from title
  const handleTitleChange = (title: string) => {
    setCreateTitle(title);
    if (!createSlug) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setCreateSlug(slug);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Series</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Create Series
        </button>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sf-text-primary text-lg">Create New Series</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-sf-text-muted hover:text-sf-text-secondary"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-sf-text-secondary mb-1">Title *</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g., Building a SaaS in Public"
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-sf-text-secondary mb-1">Description</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Brief description of this series..."
                  rows={3}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary focus:outline-none focus:border-sf-border-focus resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-sf-text-secondary mb-1">Slug *</label>
                <input
                  type="text"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  placeholder="building-a-saas-in-public"
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
                />
                <p className="text-xs text-sf-text-muted mt-1">
                  Used in URLs and RSS feeds
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={createIsPublic}
                  onChange={(e) => setCreateIsPublic(e.target.checked)}
                  className="rounded-sf"
                />
                <label htmlFor="isPublic" className="text-sm text-sf-text-secondary">
                  Make this series public
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreate}
                disabled={!createTitle || !createSlug || createSeries.isPending}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium disabled:opacity-50 transition-opacity"
              >
                {createSeries.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Create Series
                  </>
                )}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-sf-text-secondary px-4 py-2 text-sm hover:text-sf-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {seriesData.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-sf-text-muted" />
        </div>
      )}

      {!seriesData.isLoading && (
        <div className="space-y-3">
          {seriesList.map((series: any) => (
            <div
              key={series.id}
              onClick={() => router.push(`/${workspace}/series/${series.id}`)}
              className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-sf-text-primary">{series.title}</h3>
                    {series.isPublic && (
                      <span className="px-2 py-0.5 bg-sf-info/10 text-sf-info rounded-sf-full text-xs font-medium">
                        Public
                      </span>
                    )}
                  </div>
                  {series.description && (
                    <p className="text-sm text-sf-text-secondary mb-2 line-clamp-2">
                      {series.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-sf-text-muted">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      {series.postCount} {series.postCount === 1 ? "post" : "posts"}
                    </span>
                    <span>Updated {timeAgo(series.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(series.id, e)}
                  disabled={deleteSeries.isPending}
                  className="text-sf-text-muted hover:text-sf-danger transition-colors disabled:opacity-50"
                  title="Delete series"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {seriesList.length === 0 && !seriesData.isLoading && (
            <div className="text-center py-12">
              <BookOpen size={40} className="mx-auto text-sf-text-muted mb-3" />
              <h3 className="font-semibold text-sf-text-primary mb-1">No series yet</h3>
              <p className="text-sm text-sf-text-secondary mb-4">
                Create your first series to organize related content in a numbered sequence
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Plus size={16} /> Create Series
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
