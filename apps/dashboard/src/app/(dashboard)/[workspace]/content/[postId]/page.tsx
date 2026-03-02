"use client";

import { useParams, useRouter } from "next/navigation";
import { usePost, useUpdatePost } from "@/hooks/use-content";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Save, Pencil, Columns2, Eye } from "lucide-react";
import dynamic from "next/dynamic";
import { AIChatSidebar } from "@/components/editor/ai-chat-sidebar";
import { ContentPreview } from "@/components/preview/content-preview";

const MarkdownEditor = dynamic(
  () => import("@/components/editor/markdown-editor").then((m) => m.MarkdownEditor),
  { ssr: false, loading: () => <div className="flex-1 bg-sf-bg-secondary border border-sf-border rounded-sf-lg animate-pulse" /> }
);

type ViewMode = "edit" | "split" | "preview";

export default function ContentEditorPage() {
  const { workspace, postId } = useParams<{ workspace: string; postId: string }>();
  const router = useRouter();
  const post = usePost(postId);
  const update = useUpdatePost();
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("draft");
  const [externalMd, setExternalMd] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
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

  const viewModeButtons: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "edit", icon: <Pencil size={14} />, label: "Edit" },
    { mode: "split", icon: <Columns2 size={14} />, label: "Split" },
    { mode: "preview", icon: <Eye size={14} />, label: "Preview" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push(`/${workspace}/content`)} className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm">
          <ArrowLeft size={16} /> Content
        </button>
        <div className="flex items-center gap-3">
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
        {/* Edit mode: editor + AI chat sidebar (unchanged behavior) */}
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
            <div className="hidden lg:flex w-[340px] bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden flex-col">
              <AIChatSidebar
                postId={postId}
                workspace={workspace}
                onEditsApplied={handleEditsApplied}
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
        <span className="text-xs text-sf-text-muted capitalize">{post.data?.contentType?.replace(/_/g, " ")}</span>
      </div>
    </div>
  );
}
