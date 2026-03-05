"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useCollections, useCreateCollection } from "@/hooks/use-collections";
import { FolderOpen, Plus, X, Loader2, Globe } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

const THEME_LABELS: Record<string, string> = {
  "minimal-portfolio": "Minimal Portfolio",
  "technical-blog": "Technical Blog",
  changelog: "Changelog",
};

export default function CollectionsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const collections = useCollections(workspace);
  const collectionList = collections.data?.collections ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("technical-blog");
  const { createCollection, isCreating } = useCreateCollection();

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug) {
      setSlug(value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
  };

  const handleCreate = async () => {
    if (!name || !slug) return;
    await createCollection(workspace, { name, slug, description, theme });
    setShowCreate(false);
    setName("");
    setSlug("");
    setDescription("");
    setTheme("technical-blog");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Collections</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> New Collection
        </button>
      </div>

      {showCreate && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sf-text-primary text-sm">Create Collection</h3>
            <button
              onClick={() => setShowCreate(false)}
              className="text-sf-text-muted hover:text-sf-text-secondary"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Blog"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus"
              />
            </div>
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">Slug *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-blog"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-sf-text-muted mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of this collection"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus"
            />
          </div>
          <div>
            <label className="block text-xs text-sf-text-muted mb-1">Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
            >
              {Object.entries(THEME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isCreating || !name || !slug}
              className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium disabled:opacity-50 transition-opacity"
            >
              {isCreating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Plus size={14} /> Create
                </>
              )}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-sf-text-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {collectionList.map((collection: any) => (
          <div
            key={collection.id}
            onClick={() => router.push(`/${workspace}/collections/${collection.id}`)}
            className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-sf-bg-tertiary rounded-sf-full text-xs text-sf-text-secondary">
                {THEME_LABELS[collection.theme] ?? collection.theme}
              </span>
              {collection.customDomain && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-sf-bg-tertiary rounded-sf-full text-xs text-sf-text-secondary">
                  <Globe size={10} />
                  {collection.customDomain}
                </span>
              )}
              <span className="ml-auto text-xs text-sf-text-muted">
                {collection.updatedAt ? timeAgo(collection.updatedAt) : ""}
              </span>
            </div>
            <h3 className="font-semibold text-sf-text-primary mb-1">{collection.name}</h3>
            {collection.description && (
              <p className="text-sm text-sf-text-secondary line-clamp-2">
                {collection.description}
              </p>
            )}
            <p className="text-xs text-sf-text-muted mt-2 font-mono">{collection.slug}</p>
          </div>
        ))}

        {collectionList.length === 0 && !collections.isLoading && (
          <div className="text-center py-12">
            <FolderOpen size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-secondary font-medium mb-1">No collections yet</p>
            <p className="text-sf-text-muted text-sm">
              Create a collection to group posts and export as a static site.
            </p>
          </div>
        )}

        {collections.isLoading && (
          <div className="text-center py-12">
            <Loader2 size={24} className="mx-auto text-sf-text-muted animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
