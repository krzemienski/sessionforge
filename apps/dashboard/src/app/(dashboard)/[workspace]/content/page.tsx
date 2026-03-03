"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useContent, useExportContent } from "@/hooks/use-content";
import { useFilterParams } from "@/hooks/use-filter-params";
import { useState } from "react";
import { FileText, Download, X, Loader2, SlidersHorizontal } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { ExportDropdown } from "@/components/content/export-dropdown";

const STATUS_COLORS: Record<string, string> = {
  draft: "text-sf-info bg-sf-info/10",
  published: "text-sf-success bg-sf-success/10",
  archived: "text-sf-text-muted bg-sf-bg-tertiary",
};

const TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog Post",
  twitter_thread: "Twitter Thread",
  linkedin_post: "LinkedIn Post",
  changelog: "Changelog",
  newsletter: "Newsletter",
  devto_post: "Dev.to Post",
  custom: "Custom",
};

const TONE_OPTIONS = [
  { value: "", label: "All Tones" },
  { value: "technical", label: "Technical" },
  { value: "tutorial", label: "Tutorial" },
  { value: "conversational", label: "Conversational" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
];

const FILTER_DEFAULTS = {
  statusFilter: "",
  typeFilter: "",
  tone: "",
  dateFrom: "",
  dateTo: "",
};

export default function ContentPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilter, resetFilters] = useFilterParams(FILTER_DEFAULTS);

  const content = useContent(workspace, {
    limit: 50,
    status: filters.statusFilter || undefined,
    type: filters.typeFilter || undefined,
    tone: filters.tone || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  const contentList = content.data?.posts ?? [];

  const [showExport, setShowExport] = useState(false);
  const [exportType, setExportType] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const { exportContent, isExporting, exportCount } = useExportContent();

  const handleExport = async () => {
    await exportContent(workspace as string, {
      type: exportType || undefined,
      status: exportStatus || undefined,
      dateFrom: exportDateFrom || undefined,
      dateTo: exportDateTo || undefined,
    });
    setShowExport(false);
  };

  const statusTabs = [
    { label: "All", value: "" },
    { label: "Drafts", value: "draft" },
    { label: "Published", value: "published" },
    { label: "Archived", value: "archived" },
  ];

  const typeTabs = [
    { label: "All", value: "" },
    ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ label, value })),
  ];

  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Content</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "relative flex items-center gap-2 border px-4 py-2 rounded-sf font-medium text-sm transition-colors",
              showFilters
                ? "bg-sf-accent-bg border-sf-accent text-sf-accent"
                : "bg-sf-bg-secondary border-sf-border text-sf-text-primary hover:bg-sf-bg-hover"
            )}
          >
            <SlidersHorizontal size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-sf-accent text-sf-bg-primary text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowExport(!showExport)}
            className="flex items-center gap-2 bg-sf-bg-secondary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sf-text-primary text-sm">Filters</h3>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-sf-text-muted hover:text-sf-text-secondary"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setShowFilters(false)}
                className="text-sf-text-muted hover:text-sf-text-secondary"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-sf-text-muted mb-1">Tone</label>
            <select
              value={filters.tone}
              onChange={(e) => setFilter("tone", e.target.value)}
              className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary w-full"
            >
              {TONE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilter("dateFrom", e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilter("dateTo", e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
              />
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sf-text-primary text-sm">Export Options</h3>
            <button onClick={() => setShowExport(false)} className="text-sf-text-muted hover:text-sf-text-secondary">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
            >
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">From</label>
              <input
                type="date"
                value={exportDateFrom}
                onChange={(e) => setExportDateFrom(e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-sf-text-muted mb-1">To</label>
              <input
                type="date"
                value={exportDateTo}
                onChange={(e) => setExportDateTo(e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
              />
            </div>
          </div>
          {exportCount !== null && exportCount >= 50 && !isExporting && (
            <p className="text-xs text-sf-text-muted">
              {exportCount} files — large exports may take a moment to prepare.
            </p>
          )}
          {isExporting && (
            <p className="text-xs text-sf-text-muted flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Building zip archive…
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium disabled:opacity-50 transition-opacity"
            >
              {isExporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Exporting…
                </>
              ) : (
                <>
                  <Download size={14} /> Download ZIP
                </>
              )}
            </button>
            <button onClick={() => setShowExport(false)} className="text-sf-text-secondary px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter("statusFilter", tab.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-sf transition-colors",
              filters.statusFilter === tab.value
                ? "bg-sf-accent-bg text-sf-accent"
                : "text-sf-text-secondary hover:bg-sf-bg-hover"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {typeTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter("typeFilter", tab.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-sf transition-colors border",
              filters.typeFilter === tab.value
                ? "bg-sf-accent-bg text-sf-accent border-sf-accent"
                : "text-sf-text-secondary border-sf-border hover:bg-sf-bg-hover"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {contentList.map((post: any) => (
          <div
            key={post.id}
            onClick={() => router.push(`/${workspace}/content/${post.id}`)}
            className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("px-2 py-0.5 rounded-sf-full text-xs font-medium capitalize", STATUS_COLORS[post.status] || "")}>
                {post.status}
              </span>
              <span className="px-2 py-0.5 bg-sf-bg-tertiary rounded-sf-full text-xs text-sf-text-secondary">
                {TYPE_LABELS[post.contentType] || post.contentType}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-sf-text-muted">{post.updatedAt ? timeAgo(post.updatedAt) : ""}</span>
                <ExportDropdown markdown={post.markdown || ""} title={post.title || ""} />
              </div>
            </div>
            <h3 className="font-semibold text-sf-text-primary mb-1">{post.title}</h3>
            <p className="text-sm text-sf-text-secondary line-clamp-2">
              {post.markdown?.slice(0, 150)}...
            </p>
            {post.wordCount && (
              <p className="text-xs text-sf-text-muted mt-2">{post.wordCount} words</p>
            )}
          </div>
        ))}

        {contentList.length === 0 && !content.isLoading && (
          <div className="text-center py-12">
            <FileText size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-primary font-medium mb-1">No content yet</p>
            <p className="text-sf-text-secondary mb-6 text-sm">Generate content from your insights or create a new piece manually.</p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href={`/${workspace}/insights`}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
              >
                View Insights →
              </Link>
              <Link
                href="/onboarding"
                className="text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                View setup guide →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
