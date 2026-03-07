"use client";

import Link from "next/link";
import { FileText, BookOpen, FolderOpen, Settings2 } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { STATUS_COLORS, TYPE_LABELS, STATUS_TABS, SeoScoreBadge } from "@/lib/content-constants";
import { ExportDropdown } from "@/components/content/export-dropdown";

interface ContentListViewProps {
  workspace: string;
  contentList: any[];
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  seriesFilter: string;
  setSeriesFilter: (v: string) => void;
  collectionFilter: string;
  setCollectionFilter: (v: string) => void;
  seriesList: any[];
  collectionsList: any[];
  onManageSeries: () => void;
  onManageCollections: () => void;
  isLoading: boolean;
  onNavigateToPost: (postId: string) => void;
}

export function ContentListView({
  workspace,
  contentList,
  statusFilter,
  setStatusFilter,
  seriesFilter,
  setSeriesFilter,
  collectionFilter,
  setCollectionFilter,
  seriesList,
  collectionsList,
  onManageSeries,
  onManageCollections,
  isLoading,
  onNavigateToPost,
}: ContentListViewProps) {
  return (
    <>
      <div className="flex gap-2 flex-wrap mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-sf transition-colors",
              statusFilter === tab.value
                ? "bg-sf-accent-bg text-sf-accent"
                : "text-sf-text-secondary hover:bg-sf-bg-hover"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Series & Collections filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <BookOpen size={14} className="text-sf-text-muted" />
          <select
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
            className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-2.5 py-1.5 text-sm text-sf-text-primary min-w-[140px]"
          >
            <option value="">All Series</option>
            {seriesList.map((s: any) => (
              <option key={s.id} value={s.id}>{s.title} ({s.postCount})</option>
            ))}
          </select>
          <button
            onClick={onManageSeries}
            className="p-1.5 text-sf-text-muted hover:text-sf-text-primary transition-colors"
            title="Manage Series"
          >
            <Settings2 size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <FolderOpen size={14} className="text-sf-text-muted" />
          <select
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
            className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-2.5 py-1.5 text-sm text-sf-text-primary min-w-[140px]"
          >
            <option value="">All Collections</option>
            {collectionsList.map((c: any) => (
              <option key={c.id} value={c.id}>{c.title} ({c.postCount})</option>
            ))}
          </select>
          <button
            onClick={onManageCollections}
            className="p-1.5 text-sf-text-muted hover:text-sf-text-primary transition-colors"
            title="Manage Collections"
          >
            <Settings2 size={14} />
          </button>
        </div>
        {(seriesFilter || collectionFilter) && (
          <button
            onClick={() => { setSeriesFilter(""); setCollectionFilter(""); }}
            className="text-xs text-sf-text-muted hover:text-sf-accent transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="space-y-3">
        {contentList.map((post: any) => (
          <div
            key={post.id}
            onClick={() => onNavigateToPost(post.id)}
            className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("px-2 py-0.5 rounded-sf-full text-xs font-medium capitalize", STATUS_COLORS[post.status] || "")}>
                {post.status}
              </span>
              <span className="px-2 py-0.5 bg-sf-bg-tertiary rounded-sf-full text-xs text-sf-text-secondary">
                {TYPE_LABELS[post.contentType] || post.contentType}
              </span>
              <SeoScoreBadge post={post} />
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

        {contentList.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <FileText size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-primary font-medium mb-1">No content yet</p>
            <p className="text-sf-text-secondary text-sm mb-6">Generate content from your insights or create a post manually.</p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href={`/${workspace}/insights`}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
              >
                View Insights →
              </Link>
              <Link
                href={`/${workspace}/content/new`}
                className="text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                Create manually →
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
