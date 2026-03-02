"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useContent } from "@/hooks/use-content";
import { useState } from "react";
import { FileText } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  draft: "text-sf-info bg-sf-info/10",
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

export default function ContentPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const content = useContent(workspace, { limit: 50, status: statusFilter || undefined });
  const contentList = content.data?.posts ?? [];

  const tabs = [
    { label: "All", value: "" },
    { label: "Drafts", value: "draft" },
    { label: "Published", value: "published" },
    { label: "Archived", value: "archived" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Content</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
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
              <span className="ml-auto text-xs text-sf-text-muted">{post.updatedAt ? timeAgo(post.updatedAt) : ""}</span>
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
            <p className="text-sf-text-primary font-medium mb-1">No content yet</p>
            <p className="text-sf-text-secondary mb-6 text-sm">Generate content from your insights or create a new piece manually.</p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href={`/${workspace}/insights`}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
              >
                View Insights →
              </Link>
              <Link
                href="/onboarding"
                className="text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                View setup guide →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
