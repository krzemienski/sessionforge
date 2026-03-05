"use client";

import { useParams, useRouter } from "next/navigation";
import { useContent, useContentStreak, useExportContent } from "@/hooks/use-content";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, CalendarDays, LayoutGrid, List, Download, X, Loader2 } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { CalendarView } from "@/components/content/calendar-view";
import { PipelineView } from "@/components/content/pipeline-view";
import { ExportDropdown } from "@/components/content/export-dropdown";

const STATUS_COLORS: Record<string, string> = {
  idea: "text-sf-text-muted bg-sf-bg-tertiary",
  draft: "text-sf-info bg-sf-info/10",
  in_review: "text-sf-warning bg-sf-warning/10",
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

type ViewTab = "calendar" | "pipeline" | "list";

const VIEW_TABS: { label: string; value: ViewTab; icon: React.ReactNode }[] = [
  { label: "Calendar", value: "calendar", icon: <CalendarDays size={15} /> },
  { label: "Pipeline", value: "pipeline", icon: <LayoutGrid size={15} /> },
  { label: "List", value: "list", icon: <List size={15} /> },
];

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Ideas", value: "idea" },
  { label: "Drafts", value: "draft" },
  { label: "In Review", value: "in_review" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export default function ContentPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ViewTab | null>(null);

  const content = useContent(workspace, { limit: 50, status: statusFilter || undefined });
  const contentList = content.data?.posts ?? [];

  const streak = useContentStreak(workspace);
  const streakCount: number | undefined = streak.data?.streak;

  const triggers = useQuery({
    queryKey: ["triggers", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/automation/triggers?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!workspace,
  });

  // Smart default: Calendar when automation triggers exist, otherwise List
  useEffect(() => {
    if (activeTab !== null) return;
    if (triggers.isLoading) return;
    const hasTriggers = (triggers.data?.triggers ?? []).length > 0;
    setActiveTab(hasTriggers ? "calendar" : "list");
  }, [triggers.isLoading, triggers.data, activeTab]);

  // Export state
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-display">Content</h1>
          {streakCount != null && streakCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sf-accent/10 border border-sf-accent/20 rounded-sf-full">
              <span className="text-base leading-none">🔥</span>
              <span className="text-xs font-medium text-sf-accent">
                {streakCount}-{streakCount === 1 ? "day" : "days"} streak
              </span>
            </div>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 mb-6 bg-sf-bg-tertiary rounded-sf p-0.5 w-fit">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-sf transition-colors",
              activeTab === tab.value
                ? "bg-sf-bg-secondary text-sf-text-primary shadow-sm"
                : "text-sf-text-secondary hover:text-sf-text-primary"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar view */}
      {activeTab === "calendar" && (
        <CalendarView workspace={workspace} />
      )}

      {/* Pipeline view */}
      {activeTab === "pipeline" && (
        <PipelineView
          workspace={workspace}
          onNavigateToPost={(postId) => router.push(`/${workspace}/content/${postId}`)}
        />
      )}

      {/* List view */}
      {activeTab === "list" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2 flex-wrap">
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
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-2 bg-sf-bg-secondary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors"
            >
              <Download size={16} /> Export
            </button>
          </div>

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
                  <option value="idea">Idea</option>
                  <option value="draft">Draft</option>
                  <option value="in_review">In Review</option>
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
                <p className="text-sf-text-secondary">No content yet. Generate content from insights or create manually.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Loading state while determining default view */}
      {activeTab === null && (
        <div className="text-center py-12 text-sm text-sf-text-muted">Loading...</div>
      )}
    </div>
  );
}
