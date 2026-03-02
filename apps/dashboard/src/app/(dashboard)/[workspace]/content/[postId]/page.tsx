"use client";

import { useParams, useRouter } from "next/navigation";
import { usePost, useUpdatePost } from "@/hooks/use-content";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Save, History } from "lucide-react";
import dynamic from "next/dynamic";
import { AIChatSidebar } from "@/components/editor/ai-chat-sidebar";
import { ExportDropdown } from "@/components/content/export-dropdown";
import { SocialCopyButton } from "@/components/content/social-copy-button";

const MarkdownEditor = dynamic(
  () => import("@/components/editor/markdown-editor").then((m) => m.MarkdownEditor),
  { ssr: false, loading: () => <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg animate-pulse" /> }
);

const RevisionHistoryPanel = dynamic(
  () => import("@/components/editor/revision-history-panel").then((m) => m.RevisionHistoryPanel),
  { ssr: false, loading: () => <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg animate-pulse" /> }
);

const AUTO_SAVE_INTERVAL_MS = 2 * 60 * 1000;

export default function ContentEditorPage() {
  const { workspace, postId } = useParams<{ workspace: string; postId: string }>();
  const router = useRouter();
  const post = usePost(postId);
  const update = useUpdatePost();
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("draft");
  const [externalMd, setExternalMd] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const initializedRef = useRef(false);
  const lastSavedMarkdownRef = useRef("");

  useEffect(() => {
    if (post.data && !initializedRef.current) {
      setTitle(post.data.title || "");
      setMarkdown(post.data.markdown || "");
      setStatus(post.data.status || "draft");
      lastSavedMarkdownRef.current = post.data.markdown || "";
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

  function handleSave() {
    update.mutate({ id: postId, title, markdown, status, versionType: "major", editType: "user_edit" });
    lastSavedMarkdownRef.current = markdown;
  }

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

  if (post.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

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
          {showHistory ? (
            <RevisionHistoryPanel postId={postId} />
          ) : (
            <AIChatSidebar
              postId={postId}
              workspace={workspace}
              onEditsApplied={handleEditsApplied}
            />
          )}
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
    </div>
  );
}
