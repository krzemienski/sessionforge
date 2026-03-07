"use client";

import { useState } from "react";
import { X, Plus, Trash2, Loader2, BookOpen, FolderOpen } from "lucide-react";
import {
  useCreateSeries,
  useCreateCollection,
  useDeleteSeries,
  useDeleteCollection,
  type GroupItem,
} from "@/hooks/use-series-collections";

interface ManageGroupDialogProps {
  type: "series" | "collections";
  workspace: string;
  items: GroupItem[];
  isOpen: boolean;
  onClose: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ManageGroupDialog({ type, workspace, items, isOpen, onClose }: ManageGroupDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const createSeries = useCreateSeries(workspace);
  const createCollection = useCreateCollection(workspace);
  const deleteSeries = useDeleteSeries(workspace);
  const deleteCollection = useDeleteCollection(workspace);

  const createMutation = type === "series" ? createSeries : createCollection;
  const deleteMutation = type === "series" ? deleteSeries : deleteCollection;

  const label = type === "series" ? "Series" : "Collection";
  const Icon = type === "series" ? BookOpen : FolderOpen;

  if (!isOpen) return null;

  async function handleCreate() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        slug: slugify(title),
        description: description.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // error is handled by React Query
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-display text-sf-text-primary flex items-center gap-2">
            <Icon size={18} /> Manage {type === "series" ? "Series" : "Collections"}
          </h2>
          <button
            onClick={onClose}
            className="text-sf-text-secondary hover:text-sf-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {items.length === 0 && (
            <p className="text-sm text-sf-text-muted text-center py-6">
              No {type} yet. Create your first one below.
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-sf-bg-tertiary rounded-sf px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-sf-text-primary truncate">{item.title}</p>
                <p className="text-xs text-sf-text-muted">
                  {item.postCount} {item.postCount === 1 ? "post" : "posts"}
                </p>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deleteMutation.isPending}
                className="ml-2 p-1.5 text-sf-text-muted hover:text-sf-error transition-colors disabled:opacity-50"
                title={`Delete ${label.toLowerCase()}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {showCreate ? (
          <div className="border-t border-sf-border pt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-sf-text-secondary mb-1">
                Title <span className="text-sf-error">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`My ${label}`}
                autoFocus
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus placeholder:text-sf-text-tertiary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sf-text-secondary mb-1">
                Description{" "}
                <span className="text-sf-text-tertiary font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus placeholder:text-sf-text-tertiary"
              />
            </div>
            {error && <p className="text-xs text-sf-error">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setError(null);
                }}
                className="px-3 py-1.5 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending || !title.trim()}
                className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-3 py-1.5 rounded-sf text-sm font-medium hover:bg-sf-accent-dim disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Create
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-sf-border hover:border-sf-accent text-sf-text-secondary hover:text-sf-accent py-2.5 rounded-sf text-sm transition-colors"
          >
            <Plus size={14} /> New {label}
          </button>
        )}
      </div>
    </div>
  );
}
