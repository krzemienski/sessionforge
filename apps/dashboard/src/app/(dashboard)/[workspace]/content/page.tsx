"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useContent, useContentStreak, useExportContent } from "@/hooks/use-content";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LayoutGrid, List, Download, Zap } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { CalendarView } from "@/components/content/calendar-view";
import { PipelineView } from "@/components/content/pipeline-view";
import { useSeries, useCollections } from "@/hooks/use-series-collections";
import { ManageGroupDialog } from "@/components/content/manage-group-dialog";
import { useSearchParams } from "next/navigation";
import { ExportPanel } from "@/components/content/export-panel";
import { ContentListView } from "@/components/content/content-list-view";

type ViewTab = "calendar" | "pipeline" | "list";

const VIEW_TABS: { label: string; value: ViewTab; icon: React.ReactNode }[] = [
  { label: "Calendar", value: "calendar", icon: <CalendarDays size={15} /> },
  { label: "Pipeline", value: "pipeline", icon: <LayoutGrid size={15} /> },
  { label: "List", value: "list", icon: <List size={15} /> },
];

export default function ContentPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ViewTab | null>(null);

  // Series & Collections filtering
  const [seriesFilter, setSeriesFilter] = useState<string>("");
  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [showManageSeries, setShowManageSeries] = useState(false);
  const [showManageCollections, setShowManageCollections] = useState(false);

  const seriesData = useSeries(workspace);
  const collectionsData = useCollections(workspace);
  const seriesList = seriesData.data?.series ?? [];
  const collectionsList = collectionsData.data?.collections ?? [];

  // Handle ?filter= from redirect URLs
  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "series" && seriesList.length > 0 && !seriesFilter) {
      setSeriesFilter(seriesList[0].id);
    } else if (filter === "collections" && collectionsList.length > 0 && !collectionFilter) {
      setCollectionFilter(collectionsList[0].id);
    }
  }, [searchParams, seriesList, collectionsList, seriesFilter, collectionFilter]);

  const content = useContent(workspace, { limit: 50, status: statusFilter || undefined });
  const rawContentList = content.data?.posts ?? [];

  // Client-side filtering by series/collection
  const contentList = rawContentList.filter((post: any) => {
    if (seriesFilter) {
      const s = seriesList.find((s) => s.id === seriesFilter);
      if (!s) return false;
      const postIds = s.seriesPosts?.map((sp) => sp.post.id) ?? [];
      if (!postIds.includes(post.id)) return false;
    }
    if (collectionFilter) {
      const c = collectionsList.find((c) => c.id === collectionFilter);
      if (!c) return false;
      const postIds = c.collectionPosts?.map((cp) => cp.post.id) ?? [];
      if (!postIds.includes(post.id)) return false;
    }
    return true;
  });

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

  const runs = useQuery({
    queryKey: ["runs", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/automation/runs?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!workspace,
  });

  const lastRun = (runs.data?.runs ?? []).find((r: any) => r.status === "complete") as any | undefined;

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
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
        <button
          onClick={() => setShowExport(!showExport)}
          className="flex items-center justify-center gap-2 bg-sf-bg-secondary border border-sf-border text-sf-text-primary px-4 py-2.5 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors w-full sm:w-auto min-h-[44px]"
        >
          <Download size={16} /> Export
        </button>
      </div>

      {/* Pipeline status line */}
      <div className="flex items-center gap-2 px-3 py-2 bg-sf-bg-secondary border border-sf-border rounded-sf text-xs text-sf-text-secondary mb-4">
        <Zap size={13} className="text-sf-text-muted flex-shrink-0" />
        {lastRun ? (
          <span>
            Last pipeline: {timeAgo(lastRun.completedAt || lastRun.startedAt)}
            {lastRun.sessionCount != null && ` — ${lastRun.sessionCount} sessions`}
            {lastRun.insightCount != null && ` → ${lastRun.insightCount} insights`}
            {lastRun.contentType && ` → 1 ${lastRun.contentType.replace(/_/g, " ")}`}
          </span>
        ) : (
          <span>No pipeline runs yet. <Link href={`/${workspace}/automation`} className="text-sf-accent hover:underline">Set up automation</Link> to generate content automatically.</span>
        )}
      </div>

      <ExportPanel
        showExport={showExport}
        onClose={() => setShowExport(false)}
        exportType={exportType}
        setExportType={setExportType}
        exportStatus={exportStatus}
        setExportStatus={setExportStatus}
        exportDateFrom={exportDateFrom}
        setExportDateFrom={setExportDateFrom}
        exportDateTo={exportDateTo}
        setExportDateTo={setExportDateTo}
        isExporting={isExporting}
        exportCount={exportCount}
        onExport={handleExport}
      />

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
        <ContentListView
          workspace={workspace}
          contentList={contentList}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          seriesFilter={seriesFilter}
          setSeriesFilter={setSeriesFilter}
          collectionFilter={collectionFilter}
          setCollectionFilter={setCollectionFilter}
          seriesList={seriesList}
          collectionsList={collectionsList}
          onManageSeries={() => setShowManageSeries(true)}
          onManageCollections={() => setShowManageCollections(true)}
          isLoading={content.isLoading}
          onNavigateToPost={(postId) => router.push(`/${workspace}/content/${postId}`)}
        />
      )}

      {/* Loading state while determining default view */}
      {activeTab === null && (
        <div className="text-center py-12 text-sm text-sf-text-muted">Loading...</div>
      )}

      {/* Manage Series/Collections dialogs */}
      <ManageGroupDialog
        type="series"
        workspace={workspace}
        items={seriesList}
        isOpen={showManageSeries}
        onClose={() => setShowManageSeries(false)}
      />
      <ManageGroupDialog
        type="collections"
        workspace={workspace}
        items={collectionsList}
        isOpen={showManageCollections}
        onClose={() => setShowManageCollections(false)}
      />
    </div>
  );
}
