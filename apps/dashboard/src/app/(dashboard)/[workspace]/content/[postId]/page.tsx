"use client";

import { useParams, useRouter } from "next/navigation";
import { usePost, useUpdatePost, useSeoData } from "@/hooks/use-content";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Save } from "lucide-react";
import dynamic from "next/dynamic";
import { AIChatSidebar } from "@/components/editor/ai-chat-sidebar";
import { cn } from "@/lib/utils";
import { computeSeoScore } from "@/lib/seo";
import { ExportDropdown } from "@/components/content/export-dropdown";
import { SocialCopyButton } from "@/components/content/social-copy-button";

const MarkdownEditor = dynamic(
  () => import("@/components/editor/markdown-editor").then((m) => m.MarkdownEditor),
  { ssr: false, loading: () => <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg animate-pulse" /> }
);

const SeoPanel = dynamic(
  () => import("@/components/editor/seo-panel").then((m) => m.SeoPanel),
  { ssr: false }
);

export default function ContentEditorPage() {
  const { workspace, postId } = useParams<{ workspace: string; postId: string }>();
  const router = useRouter();
  const post = usePost(postId);
  const update = useUpdatePost();
  const seoData = useSeoData(postId);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("draft");
  const [externalMd, setExternalMd] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "seo">("chat");
  const initializedRef = useRef(false);

  useEffect(() => {
    if (post.data && !initializedRef.current) {
      setTitle(post.data.title || "");
      setMarkdown(post.data.markdown || "");
      setStatus(post.data.status || "draft");
      initializedRef.current = true;
    }
  }, [post.data]);

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

  if (post.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

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

        <div className="hidden lg:flex w-[340px] bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden flex-col">
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
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-sf-border">
        <span className="text-xs text-sf-text-muted">{wordCount} words</span>
        <div className="flex items-center gap-3">
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
    </div>
  );
}
