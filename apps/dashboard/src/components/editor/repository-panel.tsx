"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Download, FileText, Link2, Shield, Image, Layers, Search, History } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface SupplementaryItem {
  id: string;
  contentType: string;
  content: string;
  createdAt: string;
}

interface ContentAsset {
  id: string;
  assetType: string;
  content: string;
  caption: string | null;
  metadata: { diagramType?: string } | null;
  createdAt: string;
}

interface Revision {
  id: string;
  versionType: string;
  editType: string | null;
  wordCount: number;
  wordCountDelta: number;
  createdAt: string;
}

interface SeoData {
  seoMetadata: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    ogTitle?: string;
    ogDescription?: string;
  } | null;
  seoScore: { total: number } | null;
}

interface PostData {
  id: string;
  title: string;
  markdown: string;
  wordCount: number | null;
  contentType: string;
  status: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  insightId: string | null;
  insight: {
    id: string;
    sessionId: string | null;
    category: string;
    title: string;
  } | null;
  sourceMetadata: {
    sessionIds?: string[];
    insightIds?: string[];
    generatedBy?: string;
  } | null;
}

interface RepositoryData {
  post: PostData;
  supplementary: SupplementaryItem[];
  media: ContentAsset[];
  revisions: Revision[];
  revisionTotal: number;
  seo: SeoData;
}

interface RepositoryPanelProps {
  postId: string;
  workspace: string;
}

// ── Supplementary type labels ──────────────────────────────────────────────

const SUPPLEMENTARY_LABELS: Record<string, string> = {
  twitter_thread: "Twitter/X Thread",
  linkedin_post: "LinkedIn Post",
  newsletter_excerpt: "Newsletter Excerpt",
  executive_summary: "Executive Summary",
  pull_quotes: "Pull Quotes",
  slide_outline: "Slide Outline",
  evidence_highlights: "Evidence Highlights",
};

// ── Date formatter ─────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Unknown";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

// ── CategorySection ────────────────────────────────────────────────────────

interface CategorySectionProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CategorySection({ icon, label, count, defaultOpen, children }: CategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border border-sf-border rounded-sf overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-sf-bg-tertiary hover:bg-sf-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sf-text-secondary">{icon}</span>
          <span className="text-sm font-medium text-sf-text-primary">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded bg-sf-bg-secondary text-sf-text-secondary">
            {count}
          </span>
          <span className="text-sf-text-muted text-xs">{open ? "\u25BE" : "\u25B8"}</span>
        </div>
      </button>
      {open && (
        <div className="p-3 border-t border-sf-border space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function RepositoryPanel({ postId, workspace }: RepositoryPanelProps) {
  const [data, setData] = useState<RepositoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/content/${postId}`).then((r) => r.json()),
      fetch(`/api/content/${postId}/supplementary`).then((r) => r.json()).catch(() => ({ items: [] })),
      fetch(`/api/content/${postId}/media`).then((r) => r.json()).catch(() => ({ assets: [] })),
      fetch(`/api/content/${postId}/revisions`).then((r) => r.json()).catch(() => ({ revisions: [], total: 0 })),
      fetch(`/api/content/${postId}/seo`).then((r) => r.json()).catch(() => ({ seoMetadata: null, seoScore: null })),
    ])
      .then(([post, supplementary, media, revisions, seo]) => {
        setData({
          post,
          supplementary: supplementary.items ?? [],
          media: media.assets ?? [],
          revisions: revisions.revisions ?? [],
          revisionTotal: revisions.total ?? 0,
          seo,
        });
      })
      .catch(() => {
        setError("Failed to load repository data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [postId]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/content/${postId}/export-package`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "export-package.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Export error - user sees the button re-enable
    } finally {
      setExporting(false);
    }
  }, [postId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Loader2 size={20} className="animate-spin text-sf-text-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <p className="text-xs text-red-400 mb-2">{error ?? "Failed to load"}</p>
      </div>
    );
  }

  const wordCount = data.post.wordCount ?? data.post.markdown?.split(/\s+/).filter(Boolean).length ?? 0;
  const sourceSessionIds = data.post.sourceMetadata?.sessionIds ?? [];
  const sourceInsightIds = data.post.sourceMetadata?.insightIds ?? [];
  const sourceCount = sourceSessionIds.length + sourceInsightIds.length + (data.post.insightId ? 1 : 0);
  const seoFieldCount = countSeoFields(data.seo.seoMetadata);
  const lastRevisionDate = data.revisions.length > 0 ? data.revisions[0]?.createdAt : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">
          Repository
        </h3>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-3 py-1.5 rounded-sf font-medium text-xs hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Download size={13} />
          )}
          Export Package
        </button>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {/* Primary Content */}
        <CategorySection
          icon={<FileText size={14} />}
          label="Primary Content"
          count={1}
          defaultOpen={true}
        >
          <div className="text-xs text-sf-text-secondary space-y-1">
            <div className="flex justify-between">
              <span>Word count</span>
              <span className="text-sf-text-primary font-medium">{wordCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Type</span>
              <span className="text-sf-text-primary capitalize">{data.post.contentType?.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className="text-sf-text-primary capitalize">{data.post.status ?? "draft"}</span>
            </div>
            <div className="flex justify-between">
              <span>Last saved</span>
              <span className="text-sf-text-primary">{formatRelative(data.post.updatedAt)}</span>
            </div>
          </div>
        </CategorySection>

        {/* Source Materials */}
        <CategorySection
          icon={<Link2 size={14} />}
          label="Source Materials"
          count={sourceCount}
        >
          {sourceCount === 0 ? (
            <p className="text-xs text-sf-text-muted">No linked sources</p>
          ) : (
            <div className="text-xs text-sf-text-secondary space-y-1">
              {data.post.insight && (
                <div className="flex items-center justify-between">
                  <span className="truncate flex-1">Insight: {data.post.insight.title}</span>
                  <span className="text-sf-text-muted capitalize ml-2">{data.post.insight.category}</span>
                </div>
              )}
              {sourceSessionIds.length > 0 && (
                <div className="flex justify-between">
                  <span>Sessions referenced</span>
                  <span className="text-sf-text-primary font-medium">{sourceSessionIds.length}</span>
                </div>
              )}
              {sourceInsightIds.length > 0 && (
                <div className="flex justify-between">
                  <span>Insights referenced</span>
                  <span className="text-sf-text-primary font-medium">{sourceInsightIds.length}</span>
                </div>
              )}
            </div>
          )}
        </CategorySection>

        {/* Session Evidence */}
        <CategorySection
          icon={<Shield size={14} />}
          label="Session Evidence"
          count={data.post.insight ? 1 : 0}
        >
          {data.post.insight ? (
            <div className="text-xs text-sf-text-secondary space-y-1">
              <div className="flex justify-between">
                <span>Category</span>
                <span className="text-sf-text-primary capitalize">{data.post.insight.category}</span>
              </div>
              <div className="flex justify-between">
                <span>Session linked</span>
                <span className="text-sf-text-primary">{data.post.insight.sessionId ? "Yes" : "No"}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-sf-text-muted">No evidence linked to this post</p>
          )}
        </CategorySection>

        {/* Media Assets */}
        <CategorySection
          icon={<Image size={14} />}
          label="Media Assets"
          count={data.media.length}
        >
          {data.media.length === 0 ? (
            <p className="text-xs text-sf-text-muted">No media assets generated</p>
          ) : (
            <div className="space-y-1.5">
              {data.media.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5 text-sf-text-secondary truncate flex-1">
                    <span className="text-sf-text-muted capitalize">
                      {asset.metadata?.diagramType ?? asset.assetType}
                    </span>
                    {asset.caption && (
                      <span className="truncate text-sf-text-muted">- {asset.caption}</span>
                    )}
                  </div>
                  <span className="text-sf-text-muted ml-2 shrink-0">{formatDate(asset.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CategorySection>

        {/* Supplementary Content */}
        <CategorySection
          icon={<Layers size={14} />}
          label="Supplementary Content"
          count={data.supplementary.length}
        >
          {data.supplementary.length === 0 ? (
            <p className="text-xs text-sf-text-muted">No derivative content generated</p>
          ) : (
            <div className="space-y-1.5">
              {data.supplementary.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-sf-text-secondary">
                    {SUPPLEMENTARY_LABELS[item.contentType] ?? item.contentType}
                  </span>
                  <span className="text-sf-text-muted">{item.content.length} chars</span>
                </div>
              ))}
            </div>
          )}
        </CategorySection>

        {/* SEO Metadata */}
        <CategorySection
          icon={<Search size={14} />}
          label="SEO Metadata"
          count={seoFieldCount}
        >
          {seoFieldCount === 0 ? (
            <p className="text-xs text-sf-text-muted">No SEO metadata generated</p>
          ) : (
            <div className="text-xs text-sf-text-secondary space-y-1">
              {data.seo.seoMetadata?.metaTitle && (
                <div>
                  <span className="text-sf-text-muted">Title:</span>{" "}
                  <span className="text-sf-text-primary">{data.seo.seoMetadata.metaTitle}</span>
                </div>
              )}
              {data.seo.seoMetadata?.metaDescription && (
                <div>
                  <span className="text-sf-text-muted">Description:</span>{" "}
                  <span className="text-sf-text-primary line-clamp-2">{data.seo.seoMetadata.metaDescription}</span>
                </div>
              )}
              {data.seo.seoMetadata?.keywords && data.seo.seoMetadata.keywords.length > 0 && (
                <div>
                  <span className="text-sf-text-muted">Keywords:</span>{" "}
                  <span className="text-sf-text-primary">{data.seo.seoMetadata.keywords.join(", ")}</span>
                </div>
              )}
              {data.seo.seoScore && (
                <div className="flex justify-between pt-1 border-t border-sf-border mt-1">
                  <span>SEO Score</span>
                  <span className="text-sf-text-primary font-medium">{data.seo.seoScore.total}/100</span>
                </div>
              )}
            </div>
          )}
        </CategorySection>

        {/* Revision History */}
        <CategorySection
          icon={<History size={14} />}
          label="Revision History"
          count={data.revisionTotal}
        >
          {data.revisionTotal === 0 ? (
            <p className="text-xs text-sf-text-muted">No revisions recorded</p>
          ) : (
            <div className="text-xs text-sf-text-secondary space-y-1">
              <div className="flex justify-between">
                <span>Total revisions</span>
                <span className="text-sf-text-primary font-medium">{data.revisionTotal}</span>
              </div>
              {lastRevisionDate && (
                <div className="flex justify-between">
                  <span>Last revision</span>
                  <span className="text-sf-text-primary">{formatRelative(lastRevisionDate)}</span>
                </div>
              )}
              {data.revisions.length > 0 && (
                <div className="pt-1 border-t border-sf-border mt-1 space-y-1">
                  {data.revisions.slice(0, 5).map((rev) => (
                    <div key={rev.id} className="flex items-center justify-between">
                      <span className="capitalize text-sf-text-muted">
                        {rev.editType?.replace(/_/g, " ") ?? rev.versionType}
                      </span>
                      <div className="flex items-center gap-2">
                        {rev.wordCountDelta !== 0 && (
                          <span className={rev.wordCountDelta > 0 ? "text-emerald-400" : "text-red-400"}>
                            {rev.wordCountDelta > 0 ? "+" : ""}{rev.wordCountDelta}
                          </span>
                        )}
                        <span className="text-sf-text-muted">{formatRelative(rev.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {data.revisionTotal > 5 && (
                    <p className="text-sf-text-muted text-center pt-1">
                      +{data.revisionTotal - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CategorySection>
      </div>

      {/* Footer summary */}
      <div className="px-4 py-2 border-t border-sf-border text-xs text-sf-text-muted">
        {countTotalAssets(data)} total assets across {countNonEmptyCategories(data)} categories
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function countSeoFields(seo: SeoData["seoMetadata"]): number {
  if (!seo) return 0;
  let count = 0;
  if (seo.metaTitle) count++;
  if (seo.metaDescription) count++;
  if (seo.keywords && seo.keywords.length > 0) count++;
  if (seo.ogTitle) count++;
  if (seo.ogDescription) count++;
  return count;
}

function countTotalAssets(data: RepositoryData): number {
  return (
    1 + // primary content
    (data.post.insightId ? 1 : 0) +
    data.media.length +
    data.supplementary.length +
    data.revisionTotal +
    countSeoFields(data.seo.seoMetadata)
  );
}

function countNonEmptyCategories(data: RepositoryData): number {
  let count = 1; // primary content always exists
  const sourceCount =
    (data.post.sourceMetadata?.sessionIds?.length ?? 0) +
    (data.post.sourceMetadata?.insightIds?.length ?? 0) +
    (data.post.insightId ? 1 : 0);
  if (sourceCount > 0) count++;
  if (data.post.insightId) count++;
  if (data.media.length > 0) count++;
  if (data.supplementary.length > 0) count++;
  if (countSeoFields(data.seo.seoMetadata) > 0) count++;
  if (data.revisionTotal > 0) count++;
  return count;
}
