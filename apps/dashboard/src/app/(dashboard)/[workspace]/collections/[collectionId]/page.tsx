"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  useCollection,
  useUpdateCollection,
  useDeleteCollection,
  useCollectionPosts,
  useAddPostToCollection,
  useRemovePostFromCollection,
  useExportCollection,
} from "@/hooks/use-collections";
import { useContent } from "@/hooks/use-content";
import {
  ArrowLeft,
  Save,
  Trash2,
  Download,
  Plus,
  X,
  Loader2,
  Globe,
  FileText,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

const THEME_LABELS: Record<string, string> = {
  "minimal-portfolio": "Minimal Portfolio",
  "technical-blog": "Technical Blog",
  changelog: "Changelog",
};

export default function CollectionDetailPage() {
  const { workspace, collectionId } = useParams<{
    workspace: string;
    collectionId: string;
  }>();
  const router = useRouter();

  const collection = useCollection(collectionId);
  const collectionPosts = useCollectionPosts(collectionId);
  const allContent = useContent(workspace);
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const addPost = useAddPostToCollection();
  const removePost = useRemovePostFromCollection();
  const { exportCollection, isExporting } = useExportCollection();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("technical-blog");
  const [customDomain, setCustomDomain] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [showAddPost, setShowAddPost] = useState(false);

  if (collection.data && !initialized) {
    setName(collection.data.name ?? "");
    setSlug(collection.data.slug ?? "");
    setDescription(collection.data.description ?? "");
    setTheme(collection.data.theme ?? "technical-blog");
    setCustomDomain(collection.data.customDomain ?? "");
    setInitialized(true);
  }

  const handleSave = () => {
    updateCollection.mutate({
      id: collectionId,
      name,
      slug,
      description,
      theme,
      customDomain: customDomain || undefined,
    });
  };

  const handleDelete = async () => {
    if (!confirm("Delete this collection? Posts will not be deleted.")) return;
    await deleteCollection.mutateAsync(collectionId);
    router.push(`/${workspace}/collections`);
  };

  const handleExport = () => {
    exportCollection(collectionId, collection.data?.name ?? "collection", theme);
  };

  const currentPostIds = new Set(
    (collectionPosts.data?.posts ?? []).map((p: any) => p.id)
  );
  const availablePosts = (allContent.data?.posts ?? []).filter(
    (p: any) => !currentPostIds.has(p.id)
  );

  if (collection.isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-sf-bg-tertiary rounded w-1/3" />
        <div className="h-4 bg-sf-bg-tertiary rounded w-1/2" />
      </div>
    );
  }

  if (!collection.data) {
    return (
      <div className="text-center py-12">
        <p className="text-sf-text-secondary">Collection not found.</p>
        <button
          onClick={() => router.push(`/${workspace}/collections`)}
          className="mt-4 text-sf-accent text-sm hover:underline"
        >
          Back to Collections
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push(`/${workspace}/collections`)}
          className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm"
        >
          <ArrowLeft size={16} /> Collections
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {isExporting ? "Exporting…" : "Export Site"}
          </button>
          <button
            onClick={handleSave}
            disabled={updateCollection.isPending}
            className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {updateCollection.isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteCollection.isPending}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-red-500 px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 space-y-3">
            <h2 className="font-semibold text-sf-text-primary text-sm">Collection Settings</h2>

            <div>
              <label className="block text-xs text-sf-text-muted mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus"
              />
            </div>

            <div>
              <label className="block text-xs text-sf-text-muted mb-1">Slug *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-sf-text-muted mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus resize-none"
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

            <div>
              <label className="block text-xs text-sf-text-muted mb-1">
                <span className="flex items-center gap-1">
                  <Globe size={10} /> Custom Domain
                </span>
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="yourdomain.com"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus font-mono"
              />
            </div>
          </div>
        </div>

        {/* Posts panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sf-text-primary text-sm">
                Posts ({collectionPosts.data?.posts?.length ?? 0})
              </h2>
              <button
                onClick={() => setShowAddPost(!showAddPost)}
                className="flex items-center gap-1 text-sf-accent text-sm hover:text-sf-accent-dim transition-colors"
              >
                <Plus size={14} /> Add Post
              </button>
            </div>

            {/* Add post picker */}
            {showAddPost && (
              <div className="mb-4 bg-sf-bg-tertiary border border-sf-border rounded-sf p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-sf-text-muted font-medium">
                    Select a post to add
                  </span>
                  <button
                    onClick={() => setShowAddPost(false)}
                    className="text-sf-text-muted hover:text-sf-text-secondary"
                  >
                    <X size={14} />
                  </button>
                </div>
                {allContent.isLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-sf-text-muted" />
                  </div>
                )}
                {!allContent.isLoading && availablePosts.length === 0 && (
                  <p className="text-xs text-sf-text-muted py-2 text-center">
                    All posts are already in this collection.
                  </p>
                )}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {availablePosts.map((post: any) => (
                    <button
                      key={post.id}
                      onClick={() => {
                        addPost.mutate({ collectionId, postId: post.id });
                        setShowAddPost(false);
                      }}
                      disabled={addPost.isPending}
                      className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-sf hover:bg-sf-bg-secondary transition-colors disabled:opacity-50"
                    >
                      <FileText size={12} className="text-sf-text-muted flex-shrink-0" />
                      <span className="text-sm text-sf-text-primary truncate">
                        {post.title || "Untitled"}
                      </span>
                      <span className="ml-auto text-xs text-sf-text-muted capitalize flex-shrink-0">
                        {post.contentType?.replace(/_/g, " ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collection posts list */}
            {collectionPosts.isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-sf-text-muted" />
              </div>
            )}

            {!collectionPosts.isLoading &&
              (collectionPosts.data?.posts ?? []).length === 0 && (
                <div className="text-center py-8">
                  <FileText size={32} className="mx-auto text-sf-text-muted mb-2" />
                  <p className="text-sf-text-secondary text-sm font-medium mb-1">No posts yet</p>
                  <p className="text-sf-text-muted text-xs">
                    Add posts to include them in the exported site.
                  </p>
                </div>
              )}

            <div className="space-y-2">
              {(collectionPosts.data?.posts ?? []).map((post: any) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 p-3 bg-sf-bg-tertiary rounded-sf group"
                >
                  <FileText size={14} className="text-sf-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-sf-text-primary truncate font-medium">
                      {post.title || "Untitled"}
                    </p>
                    <p className="text-xs text-sf-text-muted capitalize">
                      {post.contentType?.replace(/_/g, " ")}
                      {post.updatedAt && ` · ${timeAgo(post.updatedAt)}`}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      router.push(`/${workspace}/content/${post.id}`)
                    }
                    className="text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      removePost.mutate({ collectionId, postId: post.id })
                    }
                    disabled={removePost.isPending}
                    className="text-sf-text-muted hover:text-red-500 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
