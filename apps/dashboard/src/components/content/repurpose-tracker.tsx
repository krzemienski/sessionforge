"use client";

import { useEffect, useState } from "react";
import { FileText, Link2, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";

interface RepurposedVariant {
  id: string;
  title: string;
  contentType: string;
  status: string;
  createdAt: string;
}

interface RepurposeData {
  variants: RepurposedVariant[];
  parentPost: RepurposedVariant | null;
}

interface RepurposeTrackerProps {
  postId: string;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-3 rounded bg-sf-bg-tertiary animate-pulse",
        className
      )}
    />
  );
}

function ContentTypeBadge({ contentType }: { contentType: string }) {
  const labels: Record<string, string> = {
    blog_post: "Blog",
    twitter_thread: "Twitter",
    linkedin_post: "LinkedIn",
    changelog: "Changelog",
    newsletter: "Newsletter",
    custom: "Custom",
  };

  const colors: Record<string, string> = {
    blog_post: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    twitter_thread: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    linkedin_post: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    changelog: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
    custom: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };

  const label = labels[contentType] || contentType;
  const colorClass = colors[contentType] || colors.custom;

  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded border font-medium",
        colorClass
      )}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    published: "bg-green-500/10 text-green-600 border-green-500/20",
    archived: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  };

  const colorClass = colors[status] || colors.draft;

  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded border font-medium capitalize",
        colorClass
      )}
    >
      {status}
    </span>
  );
}

export function RepurposeTracker({ postId }: RepurposeTrackerProps) {
  const [data, setData] = useState<RepurposeData | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const workspace = params.workspace as string;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/content/${postId}/repurposed-variants`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<RepurposeData>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-sf-text-muted" />
          <span className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
            Loading repurpose data...
          </span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Don't show the card if there's no parent and no variants
  if (!data.parentPost && data.variants.length === 0) {
    return null;
  }

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-4">
      {/* Parent Post Section */}
      {data.parentPost && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Link2 size={13} />
            Source Post
          </h3>
          <Link
            href={`/${workspace}/content/${data.parentPost.id}`}
            className="block p-3 rounded bg-sf-bg-tertiary border border-sf-border hover:border-sf-accent hover:bg-sf-bg-tertiary/80 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-sf-text-primary line-clamp-2 flex-1">
                  {data.parentPost.title}
                </h4>
                <ArrowRight
                  size={14}
                  className="text-sf-text-muted flex-shrink-0 mt-0.5"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ContentTypeBadge contentType={data.parentPost.contentType} />
                <StatusBadge status={data.parentPost.status} />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Derived Posts Section */}
      {data.variants.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={13} />
            Repurposed Variants ({data.variants.length})
          </h3>
          <div className="space-y-2">
            {data.variants.map((variant) => (
              <Link
                key={variant.id}
                href={`/${workspace}/content/${variant.id}`}
                className="block p-3 rounded bg-sf-bg-tertiary border border-sf-border hover:border-sf-accent hover:bg-sf-bg-tertiary/80 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-sf-text-primary line-clamp-2 flex-1">
                      {variant.title}
                    </h4>
                    <ArrowRight
                      size={14}
                      className="text-sf-text-muted flex-shrink-0 mt-0.5"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ContentTypeBadge contentType={variant.contentType} />
                    <StatusBadge status={variant.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
