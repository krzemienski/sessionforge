"use client";

import { useParams, useRouter } from "next/navigation";
import { usePost, useUpdatePost } from "@/hooks/use-content";
import { useDevtoIntegration, useDevtoPublication } from "@/hooks/use-devto";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Save, ChevronDown, Loader2, Send, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { AIChatSidebar } from "@/components/editor/ai-chat-sidebar";
import { DevtoPublishModal } from "@/components/publishing/devto-publish-modal";
import { ExportDropdown } from "@/components/content/export-dropdown";
import { SocialCopyButton } from "@/components/content/social-copy-button";
import { SourceCard } from "@/components/content/source-card";
import { AuthenticityBadge } from "@/components/content/authenticity-badge";

const MarkdownEditor = dynamic(
  () => import("@/components/editor/markdown-editor").then((m) => m.MarkdownEditor),
  { ssr: false, loading: () => <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg animate-pulse" /> }
);

const REPURPOSE_OPTIONS = [
  { label: "Twitter Thread", format: "twitter_thread" },
  { label: "LinkedIn Post", format: "linkedin_post" },
  { label: "Changelog Entry", format: "changelog" },
  { label: "TL;DR Summary", format: "tldr" },
] as const;

type RepurposeFormat = (typeof REPURPOSE_OPTIONS)[number]["format"];

export default function ContentEditorPage() {
  const { workspace, postId } = useParams<{ workspace: string; postId: string }>();
  const router = useRouter();
  const post = usePost(postId);
  const update = useUpdatePost();
  const devtoIntegration = useDevtoIntegration(workspace);
  const devtoPublication = useDevtoPublication(postId, workspace);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("draft");
  const [externalMd, setExternalMd] = useState<string | null>(null);
  const [repurposing, setRepurposing] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [badgeEnabled, setBadgeEnabled] = useState(false);
  const [platformFooterEnabled, setPlatformFooterEnabled] = useState(false);
  const [isDevtoModalOpen, setIsDevtoModalOpen] = useState(false);
  const initializedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (post.data && !initializedRef.current) {
      setTitle(post.data.title || "");
      setMarkdown(post.data.markdown || "");
      setStatus(post.data.status || "draft");
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

  function handleBadgeToggle(value: boolean) {
    setBadgeEnabled(value);
    update.mutate({ id: postId, badgeEnabled: value });
  }

  function handleFooterToggle(value: boolean) {
    setPlatformFooterEnabled(value);
    update.mutate({ id: postId, platformFooterEnabled: value });
  }

  function handleSave() {
    update.mutate({ id: postId, title, markdown, status });
  }

  const handleMarkdownChange = useCallback((md: string) => {
    setMarkdown(md);
  }, []);

  const handleEditsApplied = useCallback((newMd: string) => {
    setMarkdown(newMd);
    setExternalMd(newMd);
    // Reset external trigger after a tick so future updates work
    setTimeout(() => setExternalMd(null), 100);
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

          // SSE messages are separated by double newlines
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

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push(`/${workspace}/content`)} className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm">
          <ArrowLeft size={16} /> Content
        </button>
        <div className="flex items-center gap-3">
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
            <AIChatSidebar
              postId={postId}
              workspace={workspace}
              onEditsApplied={handleEditsApplied}
            />
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
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-sf-border">
        <span className="text-xs text-sf-text-muted">{wordCount} words</span>
        <div className="flex items-center gap-3">
          {(post.data?.contentType === "twitter_thread" || post.data?.contentType === "linkedin_post") && (
            <SocialCopyButton
              markdown={markdown}
              contentType={post.data.contentType as "twitter_thread" | "linkedin_post"}
            />
          )}
          <span className="text-xs text-sf-text-muted capitalize">{post.data?.contentType?.replace(/_/g, " ")}</span>
        </div>
      </div>

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
