"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Pin, BookOpen, FolderOpen } from "lucide-react";
import { useFilterParams } from "@/hooks/use-filter-params";
import { FilterPanel } from "@/components/portfolio/filter-panel";
import { BulkOperationsBar } from "@/components/portfolio/bulk-operations-bar";

interface Post {
  id: string;
  title: string;
  contentType: string;
  publishedAt: Date | null;
  createdAt: Date;
  metaDescription: string | null;
  wordCount: number | null;
  keywords: any;
  seriesId: string | null;
  collectionIds: string[];
  status: string;
}

interface Series {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  coverImage: string | null;
  isPublic: boolean;
}

interface Collection {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  coverImage: string | null;
  isPublic: boolean;
}

interface PostGridProps {
  posts: Post[];
  pinnedPosts: Post[];
  series: Series[];
  collections: Collection[];
  workspaceSlug?: string;
}

const FILTER_DEFAULTS = {
  search: "",
  series: "all",
  collection: "all",
  contentType: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function estimateReadTime(wordCount: number | null): string {
  if (!wordCount) return "5 min read";
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min read`;
}

function applyFilters(posts: Post[], filters: typeof FILTER_DEFAULTS): Post[] {
  let filtered = [...posts];

  if (filters.search) {
    const query = filters.search.toLowerCase();
    filtered = filtered.filter(
      (post) =>
        post.title.toLowerCase().includes(query) ||
        post.metaDescription?.toLowerCase().includes(query)
    );
  }

  if (filters.contentType !== "all") {
    filtered = filtered.filter(
      (post) => post.contentType === filters.contentType
    );
  }

  if (filters.series !== "all") {
    filtered = filtered.filter((post) => post.seriesId === filters.series);
  }

  if (filters.collection !== "all") {
    filtered = filtered.filter((post) =>
      post.collectionIds.includes(filters.collection)
    );
  }

  if (filters.status !== "all") {
    filtered = filtered.filter((post) => post.status === filters.status);
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    filtered = filtered.filter((post) => {
      const postDate = post.publishedAt ?? post.createdAt;
      return new Date(postDate) >= from;
    });
  }

  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter((post) => {
      const postDate = post.publishedAt ?? post.createdAt;
      return new Date(postDate) <= to;
    });
  }

  return filtered;
}

export function PostGrid({
  posts,
  pinnedPosts,
  series,
  collections,
  workspaceSlug,
}: PostGridProps) {
  const [filters, setParam, resetParams] = useFilterParams(FILTER_DEFAULTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredPosts = useMemo(
    () => applyFilters(posts, filters),
    [posts, filters]
  );

  const filteredPinnedPosts = useMemo(
    () => applyFilters(pinnedPosts, filters),
    [pinnedPosts, filters]
  );

  function togglePost(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    const visibleIds = [
      ...filteredPinnedPosts.map((p) => p.id),
      ...filteredPosts.map((p) => p.id),
    ];
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const hasActiveFilters =
    filters.search !== "" ||
    filters.series !== "all" ||
    filters.collection !== "all" ||
    filters.contentType !== "all" ||
    filters.status !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  return (
    <div>
      {/* Filters Section */}
      <FilterPanel
        filters={filters}
        onFilterChange={setParam}
        onReset={resetParams}
        posts={[...pinnedPosts, ...posts]}
        series={series}
        collections={collections}
      />

      {/* Select All Bar */}
      {(filteredPinnedPosts.length > 0 || filteredPosts.length > 0) && workspaceSlug && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
          >
            <input
              type="checkbox"
              readOnly
              checked={
                (filteredPinnedPosts.length + filteredPosts.length) > 0 &&
                [...filteredPinnedPosts, ...filteredPosts].every((p) => selectedIds.has(p.id))
              }
              className="h-4 w-4 rounded border-sf-border accent-sf-accent cursor-pointer"
            />
            <span>Select all</span>
          </button>
          {selectedIds.size > 0 && (
            <span className="text-xs text-sf-text-muted">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      {/* Featured Series */}
      {series.length > 0 && series.filter((s) => s.coverImage).length > 0 && (
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
            <BookOpen size={20} />
            Featured Series
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {series
              .filter((s) => s.coverImage)
              .slice(0, 3)
              .map((s) => (
                <div
                  key={s.id}
                  className="bg-sf-bg-secondary border border-sf-border rounded-sf overflow-hidden hover:border-sf-accent/50 transition-colors"
                >
                  <div className="relative w-full aspect-video bg-sf-bg-tertiary">
                    <Image
                      src={s.coverImage!}
                      alt={s.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h4 className="text-base font-semibold text-sf-text-primary mb-2">
                      {s.title}
                    </h4>
                    {s.description && (
                      <p className="text-sm text-sf-text-secondary line-clamp-2">
                        {s.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Featured Collections */}
      {collections.length > 0 &&
        collections.filter((c) => c.coverImage).length > 0 && (
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
              <FolderOpen size={20} />
              Featured Collections
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections
                .filter((c) => c.coverImage)
                .slice(0, 3)
                .map((c) => (
                  <div
                    key={c.id}
                    className="bg-sf-bg-secondary border border-sf-border rounded-sf overflow-hidden hover:border-sf-accent/50 transition-colors"
                  >
                    <div className="relative w-full aspect-video bg-sf-bg-tertiary">
                      <Image
                        src={c.coverImage!}
                        alt={c.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h4 className="text-base font-semibold text-sf-text-primary mb-2">
                        {c.title}
                      </h4>
                      {c.description && (
                        <p className="text-sm text-sf-text-secondary line-clamp-2">
                          {c.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* Pinned Posts Grid */}
      {filteredPinnedPosts.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-sf-text-muted mb-4">
            Pinned Posts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPinnedPosts.map((post) => (
              <article
                key={post.id}
                className={`bg-sf-bg-secondary border rounded-sf p-6 hover:border-sf-accent/50 transition-colors relative ${
                  selectedIds.has(post.id) ? "border-sf-accent" : "border-sf-border"
                }`}
              >
                {workspaceSlug && (
                  <div className="absolute top-4 left-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(post.id)}
                      onChange={() => togglePost(post.id)}
                      className="h-4 w-4 rounded border-sf-border accent-sf-accent cursor-pointer"
                      aria-label={`Select "${post.title}"`}
                    />
                  </div>
                )}

                <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-sf-accent/10 border border-sf-accent/20 rounded-sf text-xs font-medium text-sf-accent`}>
                  <Pin size={12} />
                  <span>Pinned</span>
                </div>

                <h3 className={`text-lg font-semibold mb-2 text-sf-text-primary pr-20 ${workspaceSlug ? "pl-7" : ""}`}>
                  {post.title}
                </h3>

                {post.metaDescription && (
                  <p className="text-sm text-sf-text-secondary mb-4 line-clamp-3">
                    {post.metaDescription}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs text-sf-text-muted">
                  <span>{formatDate(post.publishedAt)}</span>
                  <span>•</span>
                  <span>{estimateReadTime(post.wordCount)}</span>
                  <span>•</span>
                  <span className="capitalize">
                    {post.contentType.replace(/_/g, " ")}
                  </span>
                </div>

                {post.keywords &&
                  Array.isArray(post.keywords) &&
                  post.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {post.keywords
                        .slice(0, 3)
                        .map((keyword: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-sf-bg-tertiary border border-sf-border rounded text-xs text-sf-text-muted"
                          >
                            {keyword}
                          </span>
                        ))}
                    </div>
                  )}
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Regular Posts Grid */}
      {filteredPosts.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                className={`bg-sf-bg-secondary border rounded-sf p-6 hover:border-sf-accent/50 transition-colors relative ${
                  selectedIds.has(post.id) ? "border-sf-accent" : "border-sf-border"
                }`}
              >
                {workspaceSlug && (
                  <div className="absolute top-4 left-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(post.id)}
                      onChange={() => togglePost(post.id)}
                      className="h-4 w-4 rounded border-sf-border accent-sf-accent cursor-pointer"
                      aria-label={`Select "${post.title}"`}
                    />
                  </div>
                )}

                <h3 className={`text-lg font-semibold mb-2 text-sf-text-primary ${workspaceSlug ? "pl-7" : ""}`}>
                  {post.title}
                </h3>

                {post.metaDescription && (
                  <p className="text-sm text-sf-text-secondary mb-4 line-clamp-3">
                    {post.metaDescription}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs text-sf-text-muted">
                  <span>{formatDate(post.publishedAt)}</span>
                  <span>•</span>
                  <span>{estimateReadTime(post.wordCount)}</span>
                  <span>•</span>
                  <span className="capitalize">
                    {post.contentType.replace(/_/g, " ")}
                  </span>
                </div>

                {post.keywords &&
                  Array.isArray(post.keywords) &&
                  post.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {post.keywords
                        .slice(0, 3)
                        .map((keyword: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-sf-bg-tertiary border border-sf-border rounded text-xs text-sf-text-muted"
                          >
                            {keyword}
                          </span>
                        ))}
                    </div>
                  )}
              </article>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {filteredPinnedPosts.length === 0 && filteredPosts.length === 0 && (
        <div className="text-center py-12 text-sf-text-muted">
          {hasActiveFilters ? (
            <div className="space-y-4">
              <p className="text-base text-sf-text-secondary">
                No posts match your current filters.
              </p>
              <p className="text-sm">
                {posts.length + pinnedPosts.length} total post
                {posts.length + pinnedPosts.length !== 1 ? "s" : ""} available
                — try broadening your search.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {filters.search !== "" && (
                  <button
                    onClick={() => setParam("search", "")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sf-bg-secondary border border-sf-border rounded-sf text-xs text-sf-text-secondary hover:border-sf-accent/50 hover:text-sf-text-primary transition-colors"
                  >
                    <span>Search: &ldquo;{filters.search}&rdquo;</span>
                    <span className="text-sf-text-muted">✕</span>
                  </button>
                )}
                {filters.series !== "all" && (
                  <button
                    onClick={() => setParam("series", "all")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sf-bg-secondary border border-sf-border rounded-sf text-xs text-sf-text-secondary hover:border-sf-accent/50 hover:text-sf-text-primary transition-colors"
                  >
                    <span>
                      Series:{" "}
                      {series.find((s) => s.id === filters.series)?.title ??
                        filters.series}
                    </span>
                    <span className="text-sf-text-muted">✕</span>
                  </button>
                )}
                {filters.collection !== "all" && (
                  <button
                    onClick={() => setParam("collection", "all")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sf-bg-secondary border border-sf-border rounded-sf text-xs text-sf-text-secondary hover:border-sf-accent/50 hover:text-sf-text-primary transition-colors"
                  >
                    <span>
                      Collection:{" "}
                      {collections.find((c) => c.id === filters.collection)
                        ?.title ?? filters.collection}
                    </span>
                    <span className="text-sf-text-muted">✕</span>
                  </button>
                )}
                {filters.contentType !== "all" && (
                  <button
                    onClick={() => setParam("contentType", "all")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sf-bg-secondary border border-sf-border rounded-sf text-xs text-sf-text-secondary hover:border-sf-accent/50 hover:text-sf-text-primary transition-colors"
                  >
                    <span>
                      Type:{" "}
                      {filters.contentType.replace(/_/g, " ")}
                    </span>
                    <span className="text-sf-text-muted">✕</span>
                  </button>
                )}
                {filters.status !== "all" && (
                  <button
                    onClick={() => setParam("status", "all")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sf-bg-secondary border border-sf-border rounded-sf text-xs text-sf-text-secondary hover:border-sf-accent/50 hover:text-sf-text-primary transition-colors"
                  >
                    <span>Status: {filters.status}</span>
                    <span className="text-sf-text-muted">✕</span>
                  </button>
                )}
                {filters.dateFrom !== "" && (
                  <button
                    onClick={() => setParam("dateFrom", "")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sf-bg-secondary border border-sf-border rounded-sf text-xs text-sf-text-secondary hover:border-sf-accent/50 hover:text-sf-text-primary transition-colors"
                  >
                    <span>From: {filters.dateFrom}</span>
                    <span className="text-sf-text-muted">✕</span>
                  </button>
                )}
                {filters.dateTo !== "" && (
                  <button
                    onClick={() => setParam("dateTo", "")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sf-bg-secondary border border-sf-border rounded-sf text-xs text-sf-text-secondary hover:border-sf-accent/50 hover:text-sf-text-primary transition-colors"
                  >
                    <span>To: {filters.dateTo}</span>
                    <span className="text-sf-text-muted">✕</span>
                  </button>
                )}
              </div>
              <button
                onClick={resetParams}
                className="mt-2 text-xs text-sf-accent hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <p>No content published yet.</p>
          )}
        </div>
      )}

      {/* Bulk Operations Bar */}
      {workspaceSlug && (
        <BulkOperationsBar
          selectedCount={selectedIds.size}
          selectedPostIds={Array.from(selectedIds)}
          selectedPosts={[...filteredPinnedPosts, ...filteredPosts].filter((p) =>
            selectedIds.has(p.id)
          )}
          workspaceSlug={workspaceSlug}
          onClearSelection={clearSelection}
        />
      )}
    </div>
  );
}
