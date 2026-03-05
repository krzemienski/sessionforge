"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSingleSeries } from "@/hooks/use-series";

interface SeriesNavLinksProps {
  postId: string;
  seriesId: string;
  workspace: string;
}

export function SeriesNavLinks({ postId, seriesId, workspace }: SeriesNavLinksProps) {
  const { data: series, isLoading } = useSingleSeries(seriesId);

  if (isLoading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-24 rounded bg-sf-bg-tertiary animate-pulse" />
          <div className="h-4 w-32 rounded bg-sf-bg-tertiary animate-pulse" />
          <div className="h-4 w-24 rounded bg-sf-bg-tertiary animate-pulse" />
        </div>
      </div>
    );
  }

  if (!series || !series.seriesPosts || series.seriesPosts.length === 0) {
    return null;
  }

  // Find the current post's index in the series
  const currentIndex = series.seriesPosts.findIndex(
    (sp: any) => sp.post.id === postId
  );

  if (currentIndex === -1) {
    return null;
  }

  const totalParts = series.seriesPosts.length;
  const currentPart = currentIndex + 1;
  const prevPost = currentIndex > 0 ? series.seriesPosts[currentIndex - 1].post : null;
  const nextPost = currentIndex < totalParts - 1 ? series.seriesPosts[currentIndex + 1].post : null;

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Previous link */}
        <div className="flex-1 min-w-0">
          {prevPost ? (
            <Link
              href={`/${workspace}/content/${prevPost.id}`}
              className="flex items-center gap-2 text-sm text-sf-text-secondary hover:text-sf-accent transition-colors group"
            >
              <ChevronLeft size={16} className="flex-shrink-0 group-hover:translate-x-[-2px] transition-transform" />
              <div className="min-w-0">
                <div className="text-xs text-sf-text-muted uppercase tracking-wider">
                  Previous
                </div>
                <div className="truncate font-medium">
                  {prevPost.title}
                </div>
              </div>
            </Link>
          ) : (
            <div className="opacity-50 cursor-not-allowed">
              <div className="text-xs text-sf-text-muted uppercase tracking-wider">
                Previous
              </div>
              <div className="text-sm text-sf-text-secondary">
                No previous part
              </div>
            </div>
          )}
        </div>

        {/* Part indicator */}
        <div className="text-center px-4">
          <div className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
            {series.title}
          </div>
          <div className="text-sm text-sf-text-secondary mt-1">
            Part <span className="text-sf-accent font-semibold">{currentPart}</span> of {totalParts}
          </div>
        </div>

        {/* Next link */}
        <div className="flex-1 min-w-0 text-right">
          {nextPost ? (
            <Link
              href={`/${workspace}/content/${nextPost.id}`}
              className="flex items-center gap-2 justify-end text-sm text-sf-text-secondary hover:text-sf-accent transition-colors group"
            >
              <div className="min-w-0">
                <div className="text-xs text-sf-text-muted uppercase tracking-wider">
                  Next
                </div>
                <div className="truncate font-medium">
                  {nextPost.title}
                </div>
              </div>
              <ChevronRight size={16} className="flex-shrink-0 group-hover:translate-x-[2px] transition-transform" />
            </Link>
          ) : (
            <div className="opacity-50 cursor-not-allowed">
              <div className="text-xs text-sf-text-muted uppercase tracking-wider">
                Next
              </div>
              <div className="text-sm text-sf-text-secondary">
                No next part
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
