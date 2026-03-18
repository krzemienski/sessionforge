"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Search, Pin, BookOpen, FolderOpen } from "lucide-react";

interface Post {
  id: string;
  title: string;
  contentType: string;
  publishedAt: Date | null;
  createdAt: Date;
  metaDescription: string | null;
  wordCount: number | null;
  keywords: any;
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
}

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

export function PostGrid({
  posts,
  pinnedPosts,
  series,
  collections,
}: PostGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<string>("all");
  const [selectedCollection, setSelectedCollection] = useState<string>("all");
  const [selectedContentType, setSelectedContentType] = useState<string>("all");

  // Get unique content types
  const contentTypes = useMemo(() => {
    const types = new Set<string>();
    [...pinnedPosts, ...posts].forEach((post) => {
      types.add(post.contentType);
    });
    return Array.from(types).sort();
  }, [posts, pinnedPosts]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    let filtered = [...posts];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.metaDescription?.toLowerCase().includes(query)
      );
    }

    // Filter by content type
    if (selectedContentType !== "all") {
      filtered = filtered.filter(
        (post) => post.contentType === selectedContentType
      );
    }

    // TODO: Filter by series/collection when post relationships are available
    // For now, series and collection filters are shown but don't filter yet

    return filtered;
  }, [posts, searchQuery, selectedContentType]);

  // Filter pinned posts with same logic
  const filteredPinnedPosts = useMemo(() => {
    let filtered = [...pinnedPosts];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.metaDescription?.toLowerCase().includes(query)
      );
    }

    if (selectedContentType !== "all") {
      filtered = filtered.filter(
        (post) => post.contentType === selectedContentType
      );
    }

    return filtered;
  }, [pinnedPosts, searchQuery, selectedContentType]);

  const hasActiveFilters =
    searchQuery ||
    selectedSeries !== "all" ||
    selectedCollection !== "all" ||
    selectedContentType !== "all";

  return (
    <div>
      {/* Filters Section */}
      <div className="mb-8 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-text-muted"
            size={18}
          />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-accent"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Series Filter */}
          {series.length > 0 && (
            <select
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value)}
              className="px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
            >
              <option value="all">All Series</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          )}

          {/* Collection Filter */}
          {collections.length > 0 && (
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
            >
              <option value="all">All Collections</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          {/* Content Type Filter */}
          {contentTypes.length > 1 && (
            <select
              value={selectedContentType}
              onChange={(e) => setSelectedContentType(e.target.value)}
              className="px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
            >
              <option value="all">All Types</option>
              {contentTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedSeries("all");
              setSelectedCollection("all");
              setSelectedContentType("all");
            }}
            className="text-sm text-sf-accent hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Featured Series */}
      {series.length > 0 && series.filter(s => s.coverImage).length > 0 && (
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
            <BookOpen size={20} />
            Featured Series
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {series
              .filter(s => s.coverImage)
              .slice(0, 3)
              .map((s) => (
                <div
                  key={s.id}
                  className="bg-sf-bg-secondary border border-sf-border rounded-sf overflow-hidden hover:border-sf-accent/50 transition-colors"
                >
                  {/* Cover Image */}
                  <div className="relative w-full aspect-video bg-sf-bg-tertiary">
                    <Image
                      src={s.coverImage!}
                      alt={s.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  {/* Content */}
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
      {collections.length > 0 && collections.filter(c => c.coverImage).length > 0 && (
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
            <FolderOpen size={20} />
            Featured Collections
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections
              .filter(c => c.coverImage)
              .slice(0, 3)
              .map((c) => (
                <div
                  key={c.id}
                  className="bg-sf-bg-secondary border border-sf-border rounded-sf overflow-hidden hover:border-sf-accent/50 transition-colors"
                >
                  {/* Cover Image */}
                  <div className="relative w-full aspect-video bg-sf-bg-tertiary">
                    <Image
                      src={c.coverImage!}
                      alt={c.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  {/* Content */}
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
                className="bg-sf-bg-secondary border border-sf-border rounded-sf p-6 hover:border-sf-accent/50 transition-colors relative"
              >
                {/* Pinned Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-sf-accent/10 border border-sf-accent/20 rounded-sf text-xs font-medium text-sf-accent">
                  <Pin size={12} />
                  <span>Pinned</span>
                </div>

                <h3 className="text-lg font-semibold mb-2 text-sf-text-primary pr-20">
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

                {/* Keywords/Tags */}
                {post.keywords && Array.isArray(post.keywords) && post.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {post.keywords.slice(0, 3).map((keyword: string, idx: number) => (
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
                className="bg-sf-bg-secondary border border-sf-border rounded-sf p-6 hover:border-sf-accent/50 transition-colors"
              >
                <h3 className="text-lg font-semibold mb-2 text-sf-text-primary">
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

                {/* Keywords/Tags */}
                {post.keywords && Array.isArray(post.keywords) && post.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {post.keywords.slice(0, 3).map((keyword: string, idx: number) => (
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
            <p>No posts match your filters. Try adjusting your search.</p>
          ) : (
            <p>No content published yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
