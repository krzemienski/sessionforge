"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePost, useUpdatePost, useSeoData } from "@/hooks/use-content";
import { useDevtoIntegration, useDevtoPublication } from "@/hooks/use-devto";
import { useGhostIntegration, useGhostPublication } from "@/hooks/use-ghost";
import { useMediumIntegration, useMediumPublication } from "@/hooks/use-medium";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Save, ExternalLink, Send, RefreshCw, Pencil, Columns2, Eye, ChevronDown, Loader2, History, MessageSquare, X, ShieldCheck, MoreHorizontal, Search, BookOpen, Quote, FileText, Image, GitBranch } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import dynamic from "next/dynamic";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import type { Layout } from "react-resizable-panels";
import { AIChatSidebar } from "@/components/editor/ai-chat-sidebar";
import { InlineEditControls } from "@/components/editor/inline-edit-controls";
import { useEditorChat } from "@/hooks/use-editor-chat";
import { cn } from "@/lib/utils";
import { computeSeoScore } from "@/lib/seo";

const HashnodePublishModal = dynamic(
  () => import("@/components/publish/hashnode-publish-modal").then((m) => m.HashnodePublishModal),
  { ssr: false }
);
const DevtoPublishModal = dynamic(
  () => import("@/components/publishing/devto-publish-modal").then((m) => m.DevtoPublishModal),
  { ssr: false }
);
const GhostPublishModal = dynamic(
  () => import("@/components/publishing/ghost-publish-modal").then((m) => m.GhostPublishModal),
  { ssr: false }
);
const MediumPublishModal = dynamic(
  () => import("@/components/publishing/medium-publish-modal").then((m) => m.MediumPublishModal),
  { ssr: false }
);
const CreateTemplateDialog = dynamic(
  () => import("@/components/templates/create-template-dialog").then((m) => m.CreateTemplateDialog),
  { ssr: false }
);
import { ExportDropdown } from "@/components/content/export-dropdown";
import { SocialCopyButton } from "@/components/content/social-copy-button";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";
import { SourceCard } from "@/components/content/source-card";
import { AuthenticityBadge } from "@/components/content/authenticity-badge";
import { ContentPreview } from "@/components/preview/content-preview";
import { EvidenceExplorer } from "@/components/editor/evidence-explorer";
import { SupplementaryPanel } from "@/components/editor/supplementary-panel";
import { MediaPanel } from "@/components/editor/media-panel";
import { RepositoryPanel } from "@/components/editor/repository-panel";
import { ResearchPanel } from "@/components/editor/research-panel";
import { SeriesNavLinks } from "@/components/series/series-nav-links";
import { CitationToggle, type CitationDensity } from "@/components/citations/citation-toggle";
import { RepurposeButton } from "@/components/content/repurpose-button";
import { RepurposeTracker } from "@/components/content/repurpose-tracker";
import { useRiskFlags, useResolveFlag } from "@/hooks/use-risk-flags";
import { useVerification } from "@/hooks/use-verification";
import type { RiskFlag, VerificationSummary } from "@/lib/verification/types";
import { useApprovalSettings, useReviewStatus, useSubmitForReview, useWorkspaceMembers } from "@/hooks/use-approval";
import { useSession } from "@/lib/auth-client";

const MarkdownEditor = dynamic(
  () => import("@/components/editor/markdown-editor").then((m) => m.MarkdownEditor),
  { ssr: false, loading: () => <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg animate-pulse" /> }
);

type ViewMode = "edit" | "split" | "preview";

const SeoPanel = dynamic(
  () => import("@/components/editor/seo-panel").then((m) => m.SeoPanel),
  { ssr: false }
);

const RevisionHistoryPanel = dynamic(
  () => import("@/components/editor/revision-history-panel").then((m) => m.RevisionHistoryPanel),
  { ssr: false, loading: () => <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg animate-pulse" /> }
);

const RiskFlagsPanel = dynamic(
  () => import("@/components/editor/risk-flags-panel").then((m) => m.RiskFlagsPanel),
  { ssr: false }
);

const PublishGateModal = dynamic(
  () => import("@/components/editor/publish-gate-modal").then((m) => m.PublishGateModal),
  { ssr: false }
);

const ApprovalPanel = dynamic(
  () => import("@/components/editor/approval-panel").then((m) => m.ApprovalPanel),
  { ssr: false }
);

const AUTO_SAVE_INTERVAL_MS = 2 * 60 * 1000;

function loadLayout(key: string, fallback: Layout): Layout {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as Layout;
  } catch {
    // ignore
  }
  return fallback;
}

function saveLayout(key: string, layout: Layout) {
  try {
    window.localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

export default function ContentEditorPage() {
  const { workspace, postId } = useParams<{ workspace: string; postId: string }>();
  const router = useRouter();
  const post = usePost(postId);
  const update = useUpdatePost();
  const seoData = useSeoData(postId);
  const devtoIntegration = useDevtoIntegration(workspace);
  const devtoPublication = useDevtoPublication(postId, workspace);
  const ghostIntegration = useGhostIntegration(workspace);
  const ghostPublication = useGhostPublication(postId, workspace);
  const mediumIntegration = useMediumIntegration(workspace);
  const mediumPublication = useMediumPublication(postId, workspace);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("draft");
  const [externalMd, setExternalMd] = useState<string | null>(null);
  const [hashnodeModalOpen, setHashnodeModalOpen] = useState(false);
  const [hashnodeUrl, setHashnodeUrl] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "seo" | "evidence" | "supplementary" | "media" | "repository" | "citations" | "verify" | "review" | "research">("chat");
  const [citationsEnabled, setCitationsEnabled] = useState(true);
  const [citationDensity, setCitationDensity] = useState<CitationDensity>("all");
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [badgeEnabled, setBadgeEnabled] = useState(false);
  const [platformFooterEnabled, setPlatformFooterEnabled] = useState(false);
  const [isDevtoModalOpen, setIsDevtoModalOpen] = useState(false);
  const [isGhostModalOpen, setIsGhostModalOpen] = useState(false);
  const [isMediumModalOpen, setIsMediumModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isPublishSheetOpen, setIsPublishSheetOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [seoRefreshKey, setSeoRefreshKey] = useState(0);
  const [isPublishGateOpen, setIsPublishGateOpen] = useState(false);
  const [approvalAlert, setApprovalAlert] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const lastSavedMarkdownRef = useRef("");
  const approvalSettings = useApprovalSettings(workspace);
  const reviewStatus = useReviewStatus(postId);
  const submitForReview = useSubmitForReview();
  const workspaceMembers = useWorkspaceMembers(workspace);
  const sessionData = useSession();
  const currentUserId = sessionData.data?.user?.id;
  const isWorkflowEnabled = approvalSettings.data?.enabled === true;
  const isApproved = reviewStatus.data?.status === "approved";
  const isWorkspaceOwner = !!(currentUserId && workspaceMembers.data?.ownerId === currentUserId);
  const isCurrentUserReviewer = !!(currentUserId && reviewStatus.data?.reviewers?.some((r: { userId: string }) => r.userId === currentUserId));

  // Risk flags & verification hooks
  const riskFlags = useRiskFlags(postId);
  const resolveFlag = useResolveFlag(postId);
  const verification = useVerification(postId);

  useEffect(() => {
    if (post.data && !initializedRef.current) {
      setTitle(post.data.title || "");
      setMarkdown(post.data.markdown || "");
      setStatus(post.data.status || "draft");
      setHashnodeUrl(post.data.hashnodeUrl || null);
      lastSavedMarkdownRef.current = post.data.markdown || "";
      setBadgeEnabled(post.data.badgeEnabled ?? false);
      setPlatformFooterEnabled(post.data.platformFooterEnabled ?? false);
      initializedRef.current = true;
    }
  }, [post.data]);

  // Auto-save every 2 minutes when content has changed since last save
  useEffect(() => {
    const interval = setInterval(() => {
      if (initializedRef.current && markdown !== lastSavedMarkdownRef.current) {
        update.mutate({
          id: postId,
          title,
          markdown,
          status,
          versionType: "minor",
          editType: "auto_save",
        });
        lastSavedMarkdownRef.current = markdown;
      }
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [postId, title, markdown, status, update]);

  function handleBadgeToggle(value: boolean) {
    setBadgeEnabled(value);
    update.mutate({ id: postId, badgeEnabled: value });
  }

  function handleFooterToggle(value: boolean) {
    setPlatformFooterEnabled(value);
    update.mutate({ id: postId, platformFooterEnabled: value });
  }

  const handleSave = useCallback(() => {
    // Prevent directly setting status to "approved" via dropdown when workflow is enabled
    // Approval must go through the review workflow
    let saveStatus = status;
    if (isWorkflowEnabled && status === "approved" && !isApproved) {
      setApprovalAlert("Cannot set status to 'Approved' directly. Content must go through the review workflow.");
      saveStatus = "in_review";
      setStatus("in_review");
    }
    // Prevent publishing via status dropdown when workflow requires approval
    if (isWorkflowEnabled && status === "published" && !isApproved) {
      setApprovalAlert("Content must be approved before it can be published. Please submit for review first.");
      saveStatus = post.data?.status || "draft";
      setStatus(saveStatus);
      return;
    }
    update.mutate(
      { id: postId, title, markdown, status: saveStatus, versionType: "major", editType: "user_edit" },
      {
        onSuccess: () => {
          fetch(`/api/content/${postId}/seo/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ regenerate: true }),
          })
            .then((res) => {
              if (res.ok) {
                setSeoRefreshKey((k) => k + 1);
              }
            })
            .catch(() => {
              // analysis is best-effort; do not surface fetch errors to the user
            });
        },
      }
    );
    lastSavedMarkdownRef.current = markdown;
  }, [update, postId, title, markdown, status, isWorkflowEnabled, isApproved, post.data?.status]);

  const handlePublish = useCallback(() => {
    // When approval workflow is enabled, block publishing unless content is approved
    if (isWorkflowEnabled && !isApproved) {
      setApprovalAlert("This content requires approval before publishing. Please submit it for review first.");
      return;
    }
    // Check for unresolved critical flags that block publishing
    const flags = riskFlags.data?.flags ?? [];
    const blockingFlags = flags.filter(
      (f: RiskFlag) => f.severity === "critical" && f.status === "unresolved"
    );
    if (blockingFlags.length > 0) {
      setIsPublishGateOpen(true);
      return;
    }
    setStatus('published');
    update.mutate(
      { id: postId, title, markdown, status: 'published', versionType: "major", editType: "user_edit" },
      {
        onSuccess: () => {
          // Haptic feedback on successful publish
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([50, 30, 50]);
          }
        },
      }
    );
    lastSavedMarkdownRef.current = markdown;
  }, [update, postId, title, markdown, riskFlags.data, isWorkflowEnabled, isApproved]);

  const handleOverridePublish = useCallback(() => {
    setIsPublishGateOpen(false);
    setStatus('published');
    // Mark blocking flags as overridden
    const flags = riskFlags.data?.flags ?? [];
    const blocking = flags.filter(
      (f: RiskFlag) => f.severity === "critical" && f.status === "unresolved"
    );
    blocking.forEach((f: RiskFlag) => {
      resolveFlag.mutate({ flagId: f.id, status: "overridden" });
    });
    update.mutate({ id: postId, title, markdown, status: 'published', versionType: "major", editType: "user_edit", overrideRiskFlags: true });
    lastSavedMarkdownRef.current = markdown;
  }, [update, resolveFlag, postId, title, markdown, riskFlags.data]);

  const handleRunVerification = useCallback(() => {
    verification.mutate({ force: false });
  }, [verification]);

  const handleResolveFlag = useCallback((flagId: string, status: "verified" | "dismissed", notes?: string) => {
    resolveFlag.mutate({ flagId, status, evidenceNotes: notes });
  }, [resolveFlag]);

  useKeyboardShortcut(SHORTCUTS.Actions[2], handleSave, { captureInInputs: true });
  useKeyboardShortcut(SHORTCUTS.Actions[3], handlePublish, { captureInInputs: true });

  const handleMarkdownChange = useCallback((md: string) => {
    setMarkdown(md);
  }, []);

  const handleEditsApplied = useCallback((newMd: string) => {
    setMarkdown(newMd);
    setExternalMd(newMd);
    // Reset external trigger after a tick so future updates work
    setTimeout(() => setExternalMd(null), 100);
    // Save AI edits immediately as a minor ai_generated revision
    update.mutate({
      id: postId,
      markdown: newMd,
      versionType: "minor",
      editType: "ai_generated",
    });
    lastSavedMarkdownRef.current = newMd;
  }, [postId, update]);

  const editorChat = useEditorChat({ postId, workspace, onEditsApplied: handleEditsApplied });

  const handleHashnodeSuccess = useCallback((url: string) => {
    setHashnodeUrl(url);
  }, []);

  const handleCitationClick = useCallback((type: string, label: string) => {
    setSidebarTab("evidence");
    setHighlightedCitation(`${type}:${label}`);
  }, []);

  if (post.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const isBlogPost = post.data?.contentType === "blog_post";
  const isDevtoConnected = devtoIntegration.data?.connected && devtoIntegration.data?.enabled;
  const isAlreadyPublished = devtoPublication.data?.published === true;
  const isGhostConnected = ghostIntegration.data?.connected && ghostIntegration.data?.enabled;
  const isAlreadyPublishedOnGhost = ghostPublication.data?.published === true;
  const isMediumConnected = mediumIntegration.data?.connected && mediumIntegration.data?.enabled;
  const isAlreadyPublishedMedium = mediumPublication.data?.published === true;

  const viewModeButtons: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "edit", icon: <Pencil size={14} />, label: "Edit" },
    { mode: "split", icon: <Columns2 size={14} />, label: "Split" },
    { mode: "preview", icon: <Eye size={14} />, label: "Preview" },
  ];

  const seoMetadata = seoData.data?.seoMetadata ?? undefined;
  const liveScore = seoData.data ? computeSeoScore(markdown, title, seoMetadata) : null;

  function seoScoreColor(score: number): string {
    if (score >= 70) return "text-sf-success";
    if (score >= 40) return "text-amber-500";
    return "text-red-500";
  }

  // Extract series info if post is part of a series
  const seriesInfo = post.data?.seriesPosts?.[0];
  const seriesId = seriesInfo?.series?.id;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4 flex-wrap gap-2">
        <button
          onClick={() => router.push(`/${workspace}/content`)}
          className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm min-h-[44px] md:min-h-0"
        >
          <ArrowLeft size={16} /> Content
        </button>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          {/* Desktop-only: individual publish buttons */}
          <div className="hidden md:contents">
            <button
              onClick={() => setIsTemplateDialogOpen(true)}
              className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors"
            >
              Create Template from Post
            </button>
            {isBlogPost && (
              <button
                onClick={() => setHashnodeModalOpen(true)}
                className="flex items-center gap-2 border border-sf-border text-sf-text-secondary px-4 py-2 rounded-sf font-medium text-sm hover:text-sf-text-primary hover:border-sf-border-focus transition-colors"
              >
                <Send size={15} />
                Publish to Hashnode
              </button>
            )}
            {isDevtoConnected && (
              <button
                onClick={() => setIsDevtoModalOpen(true)}
                disabled={devtoPublication.isLoading}
                className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
              >
                {devtoPublication.isLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {isAlreadyPublished ? "Update on Dev.to" : "Publish to Dev.to"}
              </button>
            )}
            {isGhostConnected && (
              <button
                onClick={() => setIsGhostModalOpen(true)}
                disabled={ghostPublication.isLoading}
                className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
              >
                {ghostPublication.isLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {isAlreadyPublishedOnGhost ? "Update on Ghost" : "Publish to Ghost"}
              </button>
            )}
            <button
              onClick={() => setIsMediumModalOpen(true)}
              disabled={!isMediumConnected || mediumPublication.isLoading}
              className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
            >
              {mediumPublication.isLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {isAlreadyPublishedMedium ? "Update on Medium" : "Publish to Medium"}
            </button>
          </div>

          {/* Mobile-only: collapsed Publish button */}
          <button
            onClick={() => setIsPublishSheetOpen(true)}
            className="md:hidden flex items-center gap-2 border border-sf-border text-sf-text-secondary px-3 py-2 rounded-sf font-medium text-sm hover:text-sf-text-primary hover:border-sf-border-focus transition-colors min-h-[44px] active:scale-95"
          >
            <Send size={14} />
            Publish…
          </button>

          {/* View mode toggle — always visible */}
          <div className="flex items-center bg-sf-bg-tertiary border border-sf-border rounded-sf overflow-hidden min-h-[44px] md:min-h-0">
            {viewModeButtons.map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 md:py-1.5 text-xs font-medium transition-colors min-h-[44px] md:min-h-0",
                  viewMode === mode
                    ? "bg-sf-accent text-sf-bg-primary"
                    : "text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-secondary"
                )}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Status dropdown — always visible */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 md:py-1 text-sm text-sf-text-primary min-h-[44px] md:min-h-0"
          >
            <option value="idea">Idea</option>
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="approved" disabled={isWorkflowEnabled}>Approved{isWorkflowEnabled ? " (via review)" : ""}</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          {/* Desktop-only: secondary actions inline */}
          <div className="hidden md:contents">
            <ExportDropdown markdown={markdown} title={title} />
            <RepurposeButton
              postId={postId}
              contentType={post.data?.contentType || "blog_post"}
              workspaceSlug={workspace}
            />
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-sf font-medium text-sm transition-colors",
                showHistory
                  ? "bg-sf-accent text-sf-bg-primary"
                  : "bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary hover:text-sf-text-primary"
              )}
            >
              <History size={16} />
              History
            </button>
          </div>

          {/* Mobile-only: overflow "..." button for secondary actions */}
          <button
            onClick={() => setIsMoreSheetOpen(true)}
            className="md:hidden flex items-center justify-center bg-sf-bg-tertiary border border-sf-border rounded-sf min-h-[44px] min-w-[44px] text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover transition-colors active:scale-95"
            aria-label="More actions"
          >
            <MoreHorizontal size={20} />
          </button>

          {/* Save button — always visible */}
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50 min-h-[44px] md:min-h-0"
          >
            <Save size={16} />
            {update.isPending ? "Saving..." : "Save"}
          </button>
          {isWorkflowEnabled && (status === "draft" || status === "idea") && (
            <button
              onClick={() => submitForReview.mutate({ postId })}
              disabled={submitForReview.isPending}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-sf font-medium text-sm hover:bg-amber-700 transition-colors disabled:opacity-50 min-h-[44px] md:min-h-0"
            >
              <ShieldCheck size={16} />
              {submitForReview.isPending ? "Submitting..." : "Submit for Review"}
            </button>
          )}
          {isWorkflowEnabled && !isApproved && status !== "published" && (
            <button
              disabled
              title="Content must be approved before publishing"
              className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-muted px-4 py-2 rounded-sf font-medium text-sm cursor-not-allowed min-h-[44px] md:min-h-0"
            >
              <ShieldCheck size={16} />
              Approval Required
            </button>
          )}
        </div>
      </div>

      {/* Approval workflow alert */}
      {approvalAlert && (
        <div className="flex items-center gap-3 mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-sf text-sm text-amber-400">
          <ShieldCheck size={16} className="shrink-0" />
          <span className="flex-1">{approvalAlert}</span>
          <button
            onClick={() => setApprovalAlert(null)}
            className="shrink-0 p-1 hover:bg-amber-500/20 rounded-sf transition-colors"
            aria-label="Dismiss alert"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Title Input */}
      <h1 className="sr-only">Edit Post</h1>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-transparent text-xl md:text-2xl font-bold font-display text-sf-text-primary border-none outline-none mb-3 md:mb-4 placeholder:text-sf-text-muted min-h-[44px] md:min-h-0 px-1"
        placeholder="Post title..."
        aria-label="Post title"
      />

      {/* Series navigation */}
      {seriesId && (
        <div className="mb-4">
          <SeriesNavLinks
            postId={postId}
            seriesId={seriesId}
            workspace={workspace}
          />
        </div>
      )}

      <InlineEditControls
        currentWordCount={wordCount}
        isStreaming={editorChat.isStreaming}
        onSendMessage={editorChat.sendMessage}
      />

      <div className="flex-1 flex min-h-0">
        {/* Edit mode: resizable editor + tabbed sidebar */}
        {viewMode === "edit" && (
          <PanelGroup
            orientation="horizontal"
            defaultLayout={loadLayout("editor-edit-layout", { "edit-editor": 60, "edit-sidebar": 40 })}
            onLayoutChanged={(layout) => saveLayout("editor-edit-layout", layout)}
            className="flex-1"
          >
            <Panel id="edit-editor" defaultSize={60} minSize={30} className="flex flex-col min-h-0">
              {initializedRef.current && (
                <MarkdownEditor
                  initialMarkdown={post.data?.markdown || ""}
                  onMarkdownChange={handleMarkdownChange}
                  externalMarkdown={externalMd}
                />
              )}
            </Panel>
            <PanelResizeHandle className="w-1 bg-sf-border hover:bg-sf-accent cursor-col-resize transition-colors mx-1" />
            <Panel id="edit-sidebar" defaultSize={40} minSize={20} className="hidden lg:flex flex-col gap-3 min-h-0 overflow-y-auto">
              <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden flex flex-col min-h-0">
                {/* Sidebar tabs */}
                <div className="flex gap-1 p-2 border-b border-sf-border">
                  {(["chat", "seo", "evidence", "citations", "verify", "review", "supplementary", "media", "repository", "research"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSidebarTab(tab)}
                      className={cn(
                        "px-2 py-1.5 text-xs rounded-sf transition-colors",
                        sidebarTab === tab
                          ? "bg-sf-accent-bg text-sf-accent"
                          : "text-sf-text-secondary hover:bg-sf-bg-hover"
                      )}
                    >
                      {tab === "chat" ? "AI Chat" : tab === "seo" ? "SEO" : tab === "evidence" ? "Evidence" : tab === "citations" ? "Citations" : tab === "verify" ? "Verify" : tab === "review" ? "Review" : tab === "media" ? "Media" : tab === "repository" ? "Repo" : tab === "research" ? "Research" : "More"}
                    </button>
                  ))}
                </div>
                {/* Sidebar content */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {sidebarTab === "chat" && (
                    <AIChatSidebar chat={editorChat} />
                  )}
                  {sidebarTab === "seo" && (
                    <SeoPanel
                      postId={postId}
                      markdown={markdown}
                      title={title}
                      refreshKey={seoRefreshKey}
                    />
                  )}
                  {sidebarTab === "evidence" && (
                    <EvidenceExplorer
                      postId={postId}
                      highlightedCitation={highlightedCitation}
                    />
                  )}
                  {sidebarTab === "citations" && (
                    <CitationToggle
                      markdown={markdown}
                      enabled={citationsEnabled}
                      onToggle={setCitationsEnabled}
                      density={citationDensity}
                      onDensityChange={setCitationDensity}
                    />
                  )}
                  {sidebarTab === "review" && (
                    <ApprovalPanel
                      postId={postId}
                      postStatus={status}
                      workspace={workspace}
                      members={workspaceMembers.data?.members ?? []}
                      canManage={isWorkspaceOwner}
                      isReviewer={isCurrentUserReviewer}
                    />
                  )}
                  {sidebarTab === "supplementary" && (
                    <SupplementaryPanel
                      postId={postId}
                      workspace={workspace}
                    />
                  )}
                  {sidebarTab === "media" && (
                    <MediaPanel
                      postId={postId}
                      workspace={workspace}
                    />
                  )}
                  {sidebarTab === "repository" && (
                    <RepositoryPanel
                      postId={postId}
                      workspace={workspace}
                    />
                  )}
                  {sidebarTab === "verify" && (
                    <RiskFlagsPanel
                      postId={postId}
                      flags={riskFlags.data?.flags}
                      summary={riskFlags.data?.summary}
                      isVerifying={verification.isPending}
                      onRunVerification={handleRunVerification}
                      onResolve={handleResolveFlag}
                    />
                  )}
                  {sidebarTab === "research" && (
                    <ResearchPanel
                      postId={postId}
                    />
                  )}
                </div>
              </div>
              <RepurposeTracker postId={postId} />
              {post.data?.insightId && <SourceCard postId={postId} />}
              <AuthenticityBadge
                postId={postId}
                badgeEnabled={badgeEnabled}
                platformFooterEnabled={platformFooterEnabled}
                onBadgeToggle={handleBadgeToggle}
                onFooterToggle={handleFooterToggle}
              />
            </Panel>
          </PanelGroup>
        )}

        {/* Split mode: resizable editor + preview */}
        {viewMode === "split" && (
          <PanelGroup
            orientation="horizontal"
            defaultLayout={loadLayout("editor-split-layout", { "split-editor": 50, "split-preview": 50 })}
            onLayoutChanged={(layout) => saveLayout("editor-split-layout", layout)}
            className="flex-1"
          >
            <Panel id="split-editor" defaultSize={50} minSize={30} className="flex flex-col min-h-0">
              {initializedRef.current && (
                <MarkdownEditor
                  initialMarkdown={post.data?.markdown || ""}
                  onMarkdownChange={handleMarkdownChange}
                  externalMarkdown={externalMd}
                />
              )}
            </Panel>
            <PanelResizeHandle className="w-1 bg-sf-border hover:bg-sf-accent cursor-col-resize transition-colors mx-1" />
            <Panel id="split-preview" defaultSize={50} minSize={30} className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-y-auto">
              <ContentPreview
                markdown={markdown}
                contentType={post.data?.contentType || "blog_post"}
                onCitationClick={handleCitationClick}
              />
            </Panel>
          </PanelGroup>
        )}

        {/* Preview mode: full-width preview panel */}
        {viewMode === "preview" && (
          <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-y-auto">
            <ContentPreview
              markdown={markdown}
              contentType={post.data?.contentType || "blog_post"}
              onCitationClick={handleCitationClick}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-sf-border">
        <span className="text-xs text-sf-text-muted">{wordCount} words</span>
        <div className="flex items-center gap-3">
          {hashnodeUrl && (
            <a
              href={hashnodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-sf-accent hover:underline"
            >
              <ExternalLink size={12} />
              Hashnode
            </a>
          )}
          {liveScore !== null && (
            <span className={cn("text-xs font-medium", seoScoreColor(liveScore.total))}>
              SEO: {liveScore.total}/100
            </span>
          )}
          {riskFlags.data?.summary && (
            <button
              onClick={() => setSidebarTab("verify")}
              className={cn(
                "text-xs font-medium flex items-center gap-1 hover:underline",
                riskFlags.data.summary.unresolvedCount > 0
                  ? riskFlags.data.summary.criticalCount > 0
                    ? "text-red-500"
                    : "text-amber-500"
                  : "text-sf-success"
              )}
            >
              <ShieldCheck size={12} />
              {riskFlags.data.summary.unresolvedCount > 0
                ? `${riskFlags.data.summary.unresolvedCount} flags`
                : "Verified"}
            </button>
          )}
          {(post.data?.contentType === "twitter_thread" || post.data?.contentType === "linkedin_post") && (
            <SocialCopyButton
              markdown={markdown}
              contentType={post.data.contentType as "twitter_thread" | "linkedin_post"}
            />
          )}
          <span className="text-xs text-sf-text-muted capitalize">{post.data?.contentType?.replace(/_/g, " ")}</span>
        </div>
      </div>

      <HashnodePublishModal
        postId={postId}
        workspace={workspace}
        isOpen={hashnodeModalOpen}
        onClose={() => setHashnodeModalOpen(false)}
        onSuccess={handleHashnodeSuccess}
      />

      {/* Mobile Sidebar Button */}
      <button
        onClick={() => setIsMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 bg-sf-accent text-sf-bg-primary p-4 rounded-full shadow-lg hover:bg-sf-accent-dim transition-colors z-40"
        aria-label="Open sidebar"
      >
        <MessageSquare size={24} />
      </button>

      {/* Mobile Sidebar Modal — all tabs */}
      {isMobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-sf-bg-primary">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-sf-border">
            <h2 className="text-lg font-semibold text-sf-text-primary">Editor Sidebar</h2>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-2 hover:bg-sf-bg-hover rounded-sf transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex overflow-x-auto border-b border-sf-border px-2 gap-1 scrollbar-none">
            {([
              { key: "chat" as const, label: "AI Chat", icon: <MessageSquare size={14} /> },
              { key: "seo" as const, label: "SEO", icon: <Search size={14} /> },
              { key: "evidence" as const, label: "Evidence", icon: <BookOpen size={14} /> },
              { key: "citations" as const, label: "Citations", icon: <Quote size={14} /> },
              { key: "supplementary" as const, label: "More", icon: <FileText size={14} /> },
              { key: "media" as const, label: "Media", icon: <Image size={14} /> },
              { key: "repository" as const, label: "Repo", icon: <GitBranch size={14} /> },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSidebarTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 min-h-[44px]",
                  sidebarTab === tab.key
                    ? "border-sf-accent text-sf-accent"
                    : "border-transparent text-sf-text-secondary hover:text-sf-text-primary"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 bg-sf-bg-secondary overflow-hidden flex flex-col min-h-0">
              {sidebarTab === "chat" && (
                <AIChatSidebar chat={editorChat} />
              )}
              {sidebarTab === "seo" && (
                <SeoPanel
                  postId={postId}
                  markdown={markdown}
                  title={title}
                  refreshKey={seoRefreshKey}
                />
              )}
              {sidebarTab === "evidence" && (
                <EvidenceExplorer
                  postId={postId}
                  highlightedCitation={highlightedCitation}
                />
              )}
              {sidebarTab === "citations" && (
                <CitationToggle
                  markdown={markdown}
                  enabled={citationsEnabled}
                  onToggle={setCitationsEnabled}
                  density={citationDensity}
                  onDensityChange={setCitationDensity}
                />
              )}
              {sidebarTab === "supplementary" && (
                <SupplementaryPanel
                  postId={postId}
                  workspace={workspace}
                />
              )}
              {sidebarTab === "media" && (
                <MediaPanel
                  postId={postId}
                  workspace={workspace}
                />
              )}
              {sidebarTab === "repository" && (
                <RepositoryPanel
                  postId={postId}
                  workspace={workspace}
                />
              )}
            </div>

            {/* Mobile Sidebar Footer with Source and Badge */}
            <div className="p-4 space-y-3 overflow-y-auto max-h-[30vh] border-t border-sf-border">
              <RepurposeTracker postId={postId} />
              {post.data?.insightId && <SourceCard postId={postId} />}
              <AuthenticityBadge
                postId={postId}
                badgeEnabled={badgeEnabled}
                platformFooterEnabled={platformFooterEnabled}
                onBadgeToggle={handleBadgeToggle}
                onFooterToggle={handleFooterToggle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Publish BottomSheet */}
      <BottomSheet
        isOpen={isPublishSheetOpen}
        onClose={() => setIsPublishSheetOpen(false)}
        title="Publish to…"
        snapPoints={[0.4]}
      >
        <div className="space-y-1">
          {isBlogPost && (
            <button
              onClick={() => { setIsPublishSheetOpen(false); setHashnodeModalOpen(true); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-sf text-sm text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors min-h-[44px]"
            >
              <Send size={18} />
              Publish to Hashnode
            </button>
          )}
          {isDevtoConnected && (
            <button
              onClick={() => { setIsPublishSheetOpen(false); setIsDevtoModalOpen(true); }}
              disabled={devtoPublication.isLoading}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-sf text-sm text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {devtoPublication.isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              {isAlreadyPublished ? "Update on Dev.to" : "Publish to Dev.to"}
            </button>
          )}
          {isGhostConnected && (
            <button
              onClick={() => { setIsPublishSheetOpen(false); setIsGhostModalOpen(true); }}
              disabled={ghostPublication.isLoading}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-sf text-sm text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {ghostPublication.isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              {isAlreadyPublishedOnGhost ? "Update on Ghost" : "Publish to Ghost"}
            </button>
          )}
          <button
            onClick={() => { setIsPublishSheetOpen(false); setIsMediumModalOpen(true); }}
            disabled={!isMediumConnected || mediumPublication.isLoading}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-sf text-sm text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {mediumPublication.isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
            {isAlreadyPublishedMedium ? "Update on Medium" : "Publish to Medium"}
          </button>
        </div>
      </BottomSheet>

      {/* Mobile More Actions BottomSheet */}
      <BottomSheet
        isOpen={isMoreSheetOpen}
        onClose={() => setIsMoreSheetOpen(false)}
        title="More actions"
        snapPoints={[0.35]}
      >
        <div className="space-y-1">
          <button
            onClick={() => { setIsMoreSheetOpen(false); setShowHistory((v) => !v); }}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-3 rounded-sf text-sm transition-colors min-h-[44px]",
              showHistory ? "bg-sf-accent/10 text-sf-accent" : "text-sf-text-primary hover:bg-sf-bg-tertiary"
            )}
          >
            <History size={18} />
            History
          </button>
          <div
            onClick={() => setIsMoreSheetOpen(false)}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-sf text-sm text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors min-h-[44px]"
          >
            <ExportDropdown markdown={markdown} title={title} />
          </div>
          <div
            onClick={() => setIsMoreSheetOpen(false)}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-sf text-sm text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors min-h-[44px]"
          >
            <RepurposeButton
              postId={postId}
              contentType={post.data?.contentType || "blog_post"}
              workspaceSlug={workspace}
            />
          </div>
          <button
            onClick={() => { setIsMoreSheetOpen(false); setIsTemplateDialogOpen(true); }}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-sf text-sm text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors min-h-[44px]"
          >
            <Pencil size={18} />
            Create Template from Post
          </button>
        </div>
      </BottomSheet>

      <DevtoPublishModal
        postId={postId}
        workspace={workspace}
        isOpen={isDevtoModalOpen}
        onClose={() => setIsDevtoModalOpen(false)}
        isAlreadyPublished={isAlreadyPublished}
        existingPublicationUrl={devtoPublication.data?.devtoUrl}
      />
      <GhostPublishModal
        postId={postId}
        workspace={workspace}
        isOpen={isGhostModalOpen}
        onClose={() => setIsGhostModalOpen(false)}
        isAlreadyPublished={isAlreadyPublishedOnGhost}
        existingPublicationUrl={ghostPublication.data?.ghostUrl}
      />
      <MediumPublishModal
        postId={postId}
        workspace={workspace}
        isOpen={isMediumModalOpen}
        onClose={() => setIsMediumModalOpen(false)}
        isAlreadyPublished={isAlreadyPublishedMedium}
        existingPublicationUrl={mediumPublication.data?.mediumUrl}
      />

      <CreateTemplateDialog
        postId={postId}
        workspace={workspace}
        title={title}
        markdown={markdown}
        contentType={post.data?.contentType as any || "blog_post"}
        isOpen={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
      />

      {/* Revision History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowHistory(false)}
          />

          {/* Right-side panel */}
          <div className="ml-auto relative w-full max-w-2xl bg-sf-bg-primary border-l border-sf-border shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-sf-border">
              <Link
                href={`/${workspace}/content/${postId}/revisions`}
                className="flex items-center gap-1.5 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
                onClick={() => setShowHistory(false)}
              >
                <ExternalLink size={14} />
                View full history
              </Link>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-sf-bg-hover rounded-sf transition-colors"
                aria-label="Close history"
              >
                <X size={20} />
              </button>
            </div>
            <RevisionHistoryPanel postId={postId} />
          </div>
        </div>
      )}

      <PublishGateModal
        isOpen={isPublishGateOpen}
        onClose={() => setIsPublishGateOpen(false)}
        blockingFlags={(riskFlags.data?.flags ?? []).filter(
          (f: RiskFlag) => f.severity === "critical" && f.status === "unresolved"
        )}
        canOverride={true}
        onResolveFlags={() => {
          setIsPublishGateOpen(false);
          setSidebarTab("verify");
        }}
        onOverridePublish={handleOverridePublish}
      />
    </div>
  );
}
