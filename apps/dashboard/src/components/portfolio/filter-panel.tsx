"use client";

import { useMemo, useState } from "react";
import { Search, X, Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { useFilterPresets, MAX_PRESETS } from "@/hooks/use-filter-presets";

export interface FilterState {
  search: string;
  series: string;
  collection: string;
  contentType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

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
  status?: string;
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

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onReset: () => void;
  posts: Post[];
  series: Series[];
  collections: Collection[];
  workspaceSlug?: string;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
  { value: "idea", label: "Idea" },
  { value: "in_review", label: "In Review" },
  { value: "scheduled", label: "Scheduled" },
];

function formatContentType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function FilterPanel({
  filters,
  onFilterChange,
  onReset,
  posts,
  series,
  collections,
  workspaceSlug,
}: FilterPanelProps) {
  const { presets, savePreset, deletePreset, isAtLimit } = useFilterPresets(
    workspaceSlug ?? "global"
  );
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetLimitError, setPresetLimitError] = useState(false);

  function handleSavePreset() {
    if (isAtLimit) {
      setPresetLimitError(true);
      return;
    }
    const name = presetName.trim();
    if (!name) return;
    const result = savePreset(name, { ...filters });
    if (result === null) {
      setPresetLimitError(true);
      return;
    }
    setPresetName("");
    setShowPresetInput(false);
    setPresetLimitError(false);
  }

  function handleLoadPreset(preset: { filters: FilterState }) {
    (Object.keys(preset.filters) as Array<keyof FilterState>).forEach((key) => {
      onFilterChange(key, preset.filters[key]);
    });
  }

  function handleDeletePreset(id: string) {
    deletePreset(id);
    setPresetLimitError(false);
  }

  function handleOpenPresetInput() {
    if (isAtLimit) {
      setPresetLimitError(true);
      return;
    }
    setPresetLimitError(false);
    setShowPresetInput(true);
    setPresetName("");
  }

  // Compute counts from the full (unfiltered) posts array
  const contentTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      counts[post.contentType] = (counts[post.contentType] ?? 0) + 1;
    });
    return counts;
  }, [posts]);

  const seriesCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      if (post.seriesId) {
        counts[post.seriesId] = (counts[post.seriesId] ?? 0) + 1;
      }
    });
    return counts;
  }, [posts]);

  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      post.collectionIds.forEach((colId) => {
        counts[colId] = (counts[colId] ?? 0) + 1;
      });
    });
    return counts;
  }, [posts]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      if (post.status) {
        counts[post.status] = (counts[post.status] ?? 0) + 1;
      }
    });
    return counts;
  }, [posts]);

  const contentTypes = useMemo(() => {
    return Object.keys(contentTypeCounts).sort();
  }, [contentTypeCounts]);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.series !== "all" ||
    filters.collection !== "all" ||
    filters.contentType !== "all" ||
    filters.status !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  return (
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
          value={filters.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-accent"
        />
        {filters.search && (
          <button
            onClick={() => onFilterChange("search", "")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sf-text-muted hover:text-sf-text-primary"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter Dropdowns Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Series Filter */}
        {series.length > 0 && (
          <select
            value={filters.series}
            onChange={(e) => onFilterChange("series", e.target.value)}
            className="px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
          >
            <option value="all">All Series</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {seriesCounts[s.id] !== undefined
                  ? ` (${seriesCounts[s.id]})`
                  : " (0)"}
              </option>
            ))}
          </select>
        )}

        {/* Collection Filter */}
        {collections.length > 0 && (
          <select
            value={filters.collection}
            onChange={(e) => onFilterChange("collection", e.target.value)}
            className="px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
          >
            <option value="all">All Collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {collectionCounts[c.id] !== undefined
                  ? ` (${collectionCounts[c.id]})`
                  : " (0)"}
              </option>
            ))}
          </select>
        )}

        {/* Content Type Filter */}
        {contentTypes.length > 1 && (
          <select
            value={filters.contentType}
            onChange={(e) => onFilterChange("contentType", e.target.value)}
            className="px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
          >
            <option value="all">All Types</option>
            {contentTypes.map((type) => (
              <option key={type} value={type}>
                {formatContentType(type)} ({contentTypeCounts[type] ?? 0})
              </option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        <select
          value={filters.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
          className="px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(({ value, label }) => {
            const count = statusCounts[value] ?? 0;
            return (
              <option key={value} value={value}>
                {label} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {/* Date Range Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-sm text-sf-text-muted whitespace-nowrap">
            From
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange("dateFrom", e.target.value)}
            className="flex-1 px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <label className="text-sm text-sf-text-muted whitespace-nowrap">
            To
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilterChange("dateTo", e.target.value)}
            className="flex-1 px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm focus:outline-none focus:border-sf-accent"
          />
        </div>
      </div>

      {/* Clear All Filters */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="text-sm text-sf-accent hover:underline"
        >
          Clear all filters
        </button>
      )}

      {/* Filter Presets */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center gap-1 bg-sf-bg-secondary border border-sf-border rounded-sf px-2 py-1 text-sm"
            >
              <button
                onClick={() => handleLoadPreset(preset)}
                className="flex items-center gap-1 text-sf-text-primary hover:text-sf-accent"
              >
                <Bookmark size={12} />
                {preset.name}
              </button>
              <button
                onClick={() => handleDeletePreset(preset.id)}
                className="text-sf-text-muted hover:text-red-400 ml-1"
                aria-label={`Delete preset ${preset.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {!showPresetInput && (
            <button
              onClick={handleOpenPresetInput}
              className="flex items-center gap-1 text-sm text-sf-text-muted hover:text-sf-accent border border-dashed border-sf-border rounded-sf px-2 py-1"
            >
              <BookmarkPlus size={14} />
              Save as preset
            </button>
          )}
        </div>

        {/* Inline name input */}
        {showPresetInput && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Preset name..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
                if (e.key === "Escape") setShowPresetInput(false);
              }}
              autoFocus
              className="px-3 py-1.5 bg-sf-bg-secondary border border-sf-border rounded-sf text-sf-text-primary text-sm placeholder:text-sf-text-muted focus:outline-none focus:border-sf-accent"
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-3 py-1.5 bg-sf-accent text-white text-sm rounded-sf hover:opacity-90 disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => setShowPresetInput(false)}
              className="px-3 py-1.5 text-sm text-sf-text-muted hover:text-sf-text-primary"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Limit feedback */}
        {presetLimitError && (
          <p className="text-sm text-red-400">
            Maximum of {MAX_PRESETS} presets reached. Delete one to save a new preset.
          </p>
        )}
      </div>
    </div>
  );
}
