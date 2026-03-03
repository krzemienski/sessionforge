"use client";

import { useParams, useRouter } from "next/navigation";
import { usePost, useUpdatePost, useSeoData } from "@/hooks/use-content";
import { useDevtoIntegration, useDevtoPublication } from "@/hooks/use-devto";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Save, ExternalLink, Send, RefreshCw, Pencil, Columns2, Eye, ChevronDown, Loader2, History } from "lucide-react";
import dynamic from "next/dynamic";
import { AIChatSidebar } from "@/components/editor/ai-chat-sidebar";
import { HashnodePublishModal } from "@/components/publish/hashnode-publish-modal";
import { cn } from "@/lib/utils";
import { computeSeoScore } from "@/lib/seo";
import { DevtoPublishModal } from "@/components/publishing/devto-publish-modal";
import { ExportDropdown } from "@/components/content/export-dropdown";
import { SocialCopyButton } from "@/components/content/social-copy-button";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";
import { SourceCard } from "@/components/content/source-card";
import { AuthenticityBadge } from "@/components/content/authenticity-badge";
import { ContentPreview } from "@/components/preview/content-preview";

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

const REPURPOSE_OPTIONS = [
  { label: "Twitter Thread", format: "twitter_thread" },
  { label: "LinkedIn Post", format: "linkedin_post" },
  { label: "Changelog Entry", format: "changelog" },
  { label: "TL;DR Summary", format: "tldr" },
] as const;

type RepurposeFormat = (typeof REPURPOSE_OPTIONS)[number]["format"];

const AUTO_SAVE_INTERVAL_MS = 2 * 60 * 1000;

export default function ContentEditorPage() {
  const { workspace, postId } = useParams<{ workspace: string; postId: string }>();
  const router = useRouter();
  const post = usePost(postId);
  const update = useUpdatePost();
  const seoData = useSeoData(postId);
  const devtoIntegration = useDevtoIntegration(workspace);
  const devtoPublication = useDevtoPublication(postId, workspace);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("draft");
  const [externalMd, setExternalMd] = useState<string | null>(null);
  const [hashnodeModalOpen, setHashnodeModalOpen] = useState(false);
  const [hashnodeUrl, setHashnodeUrl] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "seo">("chat");
  const [repurposing, setRepurposing] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [badgeEnabled, setBadgeEnabled] = useState(false);
  const [platformFooterEnabled, setPlatformFooterEnabled] = useState(false);
  const [isDevtoModalOpen, setIsDevtoModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const initializedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastSavedMarkdownRef = useRef("");

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

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
    update.mutate({ id: postId, title, markdown, status, versionType: "major", editType: "user_edit" });
    lastSavedMarkdownRef.current = markdown;
  }, [update, postId, title, markdown, status]);

  const handlePublish = useCallback(() => {
    setStatus('published');
    update.mutate({ id: postId, title, markdown, status: 'published', versionType: "major", editType: "user_edit" });
    lastSavedMarkdownRef.current = markdown;
  }, [update, postId, title, markdown]);

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

  const handleHashnodeSuccess = useCallback((url: string) => {
    setHashnodeUrl(url);
  }, []);

  async function handleRepurpose(format: RepurposeFormat, label: string) {
    setDropdownOpen(false);
    setRepurposing(label);

    try {
      const res = await fetch("/api/agents/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, sourcePostId: postId, targetFormat: format }),
      });

      if (!res.ok || !res.body) {
        setRepurposing(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingCreatePost = false;
      let newPostId: string | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";

          for (const message of messages) {
            if (!message.trim()) continue;

            let eventType = "";
            let eventData = "";

            for (const line of message.split("\n")) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6).trim();
              }
            }

            if (!eventType) continue;

            try {
              if (eventType === "tool_use") {
                const parsed = JSON.parse(eventData);
                if (parsed?.tool === "create_post") {
                  pendingCreatePost = true;
                }
              } else if (eventType === "tool_result" && pendingCreatePost) {
                pendingCreatePost = false;
                const parsed = JSON.parse(eventData);
                if (parsed?.success && parsed?.result?.id) {
                  newPostId = parsed.result.id;
                }
              } else if (eventType === "complete" || eventType === "done") {
                if (newPostId) {
                  router.push(`/${workspace}/content/${newPostId}`);
                }
                setRepurposing(null);
                return;
              } else if (eventType === "error") {
                setRepurposing(null);
                return;
              }
            } catch {
              // ignore parse errors for individual events
            }
          }
        }

        if (newPostId) {
          router.push(`/${workspace}/content/${newPostId}`);
        }
      } finally {
        reader.releaseLock();
      }
    } catch {
      // ignore errors
    } finally {
      setRepurposing(null);
    }
  }

  if (post.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const isBlogPost = post.data?.contentType === "blog_post";
  const isDevtoConnected = devtoIntegration.data?.connected && devtoIntegration.data?.enabled;
  const isAlreadyPublished = devtoPublication.data?.published === true;

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

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push(`/${workspace}/content`)} className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm">
          <ArrowLeft size={16} /> Content
        </button>
        <div className="flex items-center gap-3">
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

          {/* View mode toggle */}
          <div className="flex items-center bg-sf-bg-tertiary border border-sf-border rounded-sf overflow-hidden">
            {viewModeButtons.map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-sf-accent text-sf-bg-primary"
                    : "text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-secondary"
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-2 py-1 text-sm text-sf-text-primary"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <ExportDropdown markdown={markdown} title={title} />
          {isBlogPost && (
            <div className="relative" ref={dropdownRef}>
              {repurposing ? (
                <div className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border px-3 py-2 rounded-sf text-sm text-sf-text-secondary">
                  <Loader2 size={14} className="animate-spin" />
                  Generating {repurposing}…
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center gap-1.5 bg-sf-bg-tertiary border border-sf-border px-3 py-2 rounded-sf text-sm text-sf-text-primary hover:border-sf-accent transition-colors"
                  >
                    Repurpose <ChevronDown size={14} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-lg z-10 overflow-hidden">
                      {REPURPOSE_OPTIONS.map(({ label, format }) => (
                        <button
                          key={format}
                          onClick={() => handleRepurpose(format, label)}
                          className="w-full text-left px-3 py-2 text-sm text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-sf font-medium text-sm transition-colors ${
              showHistory
                ? "bg-sf-accent text-sf-bg-primary"
                : "bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary hover:text-sf-text-primary"
            }`}
          >
            <History size={16} />
            History
          </button>
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {update.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-transparent text-2xl font-bold font-display text-sf-text-primary border-none outline-none mb-4 placeholder:text-sf-text-muted"
        placeholder="Post title..."
      />

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Edit mode: editor + tabbed sidebar (AI chat / SEO) + source/badge */}
        {viewMode === "edit" && (
          <>
            <div className="flex-1 flex flex-col min-h-0">
              {initializedRef.current && (
                <MarkdownEditor
                  initialMarkdown={post.data?.markdown || ""}
                  onMarkdownChange={handleMarkdownChange}
                  externalMarkdown={externalMd}
                />
              )}
            </div>
            <div className="hidden lg:flex w-[340px] flex-col gap-3">
              <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden flex flex-col min-h-0">
                {/* Sidebar tabs */}
                <div className="flex gap-1 p-2 border-b border-sf-border">
                  {(["chat", "seo"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSidebarTab(tab)}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-sf transition-colors",
                        sidebarTab === tab
                          ? "bg-sf-accent-bg text-sf-accent"
                          : "text-sf-text-secondary hover:bg-sf-bg-hover"
                      )}
                    >
                      {tab === "chat" ? "AI Chat" : "SEO"}
                    </button>
                  ))}
                </div>
                {/* Sidebar content */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {sidebarTab === "chat" ? (
                    <AIChatSidebar
                      postId={postId}
                      workspace={workspace}
                      onEditsApplied={handleEditsApplied}
                    />
                  ) : (
                    <SeoPanel
                      postId={postId}
                      markdown={markdown}
                      title={title}
                    />
                  )}
                </div>
              </div>
              {post.data?.insightId && <SourceCard postId={postId} />}
              <AuthenticityBadge
                postId={postId}
                badgeEnabled={badgeEnabled}
                platformFooterEnabled={platformFooterEnabled}
                onBadgeToggle={handleBadgeToggle}
                onFooterToggle={handleFooterToggle}
              />
            </div>
          </>
        )}

        {/* Split mode: editor on left, preview on right */}
        {viewMode === "split" && (
          <>
            <div className="flex-1 flex flex-col min-h-0">
              {initializedRef.current && (
                <MarkdownEditor
                  initialMarkdown={post.data?.markdown || ""}
                  onMarkdownChange={handleMarkdownChange}
                  externalMarkdown={externalMd}
                />
              )}
            </div>
            <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-y-auto">
              <ContentPreview
                markdown={markdown}
                contentType={post.data?.contentType || "blog_post"}
              />
            </div>
          </>
        )}

        {/* Preview mode: full-width preview panel */}
        {viewMode === "preview" && (
          <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-y-auto">
            <ContentPreview
              markdown={markdown}
              contentType={post.data?.contentType || "blog_post"}
            />
          </div>
        )}
      </div>

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

      <DevtoPublishModal
        postId={postId}
        workspace={workspace}
        isOpen={isDevtoModalOpen}
        onClose={() => setIsDevtoModalOpen(false)}
        isAlreadyPublished={isAlreadyPublished}
        existingPublicationUrl={devtoPublication.data?.devtoUrl}
      />
    </div>
  );
}
