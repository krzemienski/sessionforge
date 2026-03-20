"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye,
  MousePointerClick,
  Activity,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Twitter,
  Linkedin,
  Calendar,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AttributionPost {
  postId: string;
  title: string;
  contentType: string | null;
  publishedAt: string | Date | null;
  attribution: {
    sourceSessions: string[];
  };
  channelKpis: Record<
    string,
    {
      impressions: number;
      likes: number;
      shares: number;
      comments: number;
      clicks: number;
    }
  >;
  performance: {
    avgEngagementRate: number;
  };
}

interface AttributionTableProps {
  posts: AttributionPost[];
  workspace: string;
  className?: string;
}

type SortField = "impressions" | "clicks" | "engagementRate" | "publishedAt";
type SortDir = "asc" | "desc";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter size={12} className="text-sky-400" />,
  linkedin: <Linkedin size={12} className="text-blue-500" />,
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "X",
  linkedin: "LinkedIn",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  thread: "Thread",
  post: "Post",
  article: "Article",
  newsletter: "Newsletter",
  video: "Video",
  carousel: "Carousel",
};

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sumChannelKpi(
  channelKpis: AttributionPost["channelKpis"],
  key: "impressions" | "clicks" | "likes" | "shares" | "comments"
): number {
  return Object.values(channelKpis).reduce((acc, kpi) => acc + (kpi[key] ?? 0), 0);
}

function computeEngagementRate(channelKpis: AttributionPost["channelKpis"], avgEngagementRate: number): number {
  const totalImpressions = sumChannelKpi(channelKpis, "impressions");
  if (totalImpressions > 0) {
    const totalEngaged =
      sumChannelKpi(channelKpis, "likes") +
      sumChannelKpi(channelKpis, "shares") +
      sumChannelKpi(channelKpis, "comments");
    return totalEngaged / totalImpressions;
  }
  return avgEngagementRate;
}

interface SortButtonProps {
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (field: SortField) => void;
  children: React.ReactNode;
}

function SortButton({ field, current, dir, onClick, children }: SortButtonProps) {
  const active = field === current;
  return (
    <button
      onClick={() => onClick(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors",
        active ? "text-sf-accent" : "text-sf-text-secondary hover:text-sf-text-primary"
      )}
    >
      {children}
      {active ? (
        dir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />
      ) : (
        <ArrowUpDown size={12} className="opacity-40" />
      )}
    </button>
  );
}

export function AttributionTable({ posts, workspace, className }: AttributionTableProps) {
  const [sortField, setSortField] = useState<SortField>("impressions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const sorted = [...posts].sort((a, b) => {
    let av = 0;
    let bv = 0;
    if (sortField === "impressions") {
      av = sumChannelKpi(a.channelKpis, "impressions");
      bv = sumChannelKpi(b.channelKpis, "impressions");
    } else if (sortField === "clicks") {
      av = sumChannelKpi(a.channelKpis, "clicks");
      bv = sumChannelKpi(b.channelKpis, "clicks");
    } else if (sortField === "engagementRate") {
      av = computeEngagementRate(a.channelKpis, a.performance.avgEngagementRate);
      bv = computeEngagementRate(b.channelKpis, b.performance.avgEngagementRate);
    } else if (sortField === "publishedAt") {
      av = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      bv = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    }
    return sortDir === "desc" ? bv - av : av - bv;
  });

  if (posts.length === 0) {
    return (
      <div
        className={cn(
          "bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-12 flex flex-col items-center justify-center text-center",
          className
        )}
      >
        <FileText size={40} className="text-sf-text-secondary opacity-40 mb-3" />
        <p className="text-sf-text-primary font-semibold font-display mb-1">No attributed posts</p>
        <p className="text-sm text-sf-text-secondary max-w-xs">
          Publish content from sessions and connect social integrations to see attribution data here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-sf-lg border border-sf-border", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-sf-bg-tertiary border-b border-sf-border">
            <th className="text-left px-4 py-3 min-w-[200px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
                Post
              </span>
            </th>
            <th className="text-left px-4 py-3 min-w-[110px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
                Type
              </span>
            </th>
            <th className="text-left px-4 py-3 min-w-[130px]">
              <SortButton field="publishedAt" current={sortField} dir={sortDir} onClick={handleSort}>
                <Calendar size={12} />
                Published
              </SortButton>
            </th>
            <th className="text-left px-4 py-3 min-w-[100px]">
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
                <Users size={12} />
                Sessions
              </span>
            </th>
            <th className="text-left px-4 py-3 min-w-[140px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
                Channels
              </span>
            </th>
            <th className="text-right px-4 py-3 min-w-[110px]">
              <div className="flex justify-end">
                <SortButton field="impressions" current={sortField} dir={sortDir} onClick={handleSort}>
                  <Eye size={12} />
                  Impressions
                </SortButton>
              </div>
            </th>
            <th className="text-right px-4 py-3 min-w-[90px]">
              <div className="flex justify-end">
                <SortButton field="clicks" current={sortField} dir={sortDir} onClick={handleSort}>
                  <MousePointerClick size={12} />
                  Clicks
                </SortButton>
              </div>
            </th>
            <th className="text-right px-4 py-3 min-w-[120px]">
              <div className="flex justify-end">
                <SortButton field="engagementRate" current={sortField} dir={sortDir} onClick={handleSort}>
                  <Activity size={12} />
                  Eng. Rate
                </SortButton>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((post, idx) => {
            const channels = Object.keys(post.channelKpis);
            const impressions = sumChannelKpi(post.channelKpis, "impressions");
            const clicks = sumChannelKpi(post.channelKpis, "clicks");
            const engRate = computeEngagementRate(post.channelKpis, post.performance.avgEngagementRate);
            const sessionCount = post.attribution.sourceSessions.length;

            return (
              <tr
                key={post.postId}
                className={cn(
                  "border-b border-sf-border last:border-0 hover:bg-sf-bg-tertiary/50 transition-colors",
                  idx % 2 === 1 && "bg-sf-bg-tertiary/20"
                )}
              >
                {/* Post title */}
                <td className="px-4 py-3">
                  <Link
                    href={`/${workspace}/content/${post.postId}`}
                    className="font-medium text-sf-text-primary hover:text-sf-accent transition-colors line-clamp-2 leading-snug"
                  >
                    {post.title || "Untitled post"}
                  </Link>
                </td>

                {/* Content type */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sf-bg-tertiary text-sf-text-secondary border border-sf-border">
                    {CONTENT_TYPE_LABELS[post.contentType ?? ""] ?? post.contentType ?? "—"}
                  </span>
                </td>

                {/* Published date */}
                <td className="px-4 py-3 text-sf-text-secondary whitespace-nowrap">
                  {formatDate(post.publishedAt)}
                </td>

                {/* Source sessions */}
                <td className="px-4 py-3">
                  {sessionCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-sf-text-primary font-medium">
                      <Users size={12} className="text-sf-accent" />
                      {sessionCount}
                    </span>
                  ) : (
                    <span className="text-sf-text-secondary">—</span>
                  )}
                </td>

                {/* Channels */}
                <td className="px-4 py-3">
                  {channels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {channels.map((platform) => (
                        <span
                          key={platform}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary"
                        >
                          {PLATFORM_ICONS[platform]}
                          {PLATFORM_LABELS[platform] ?? platform}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sf-text-secondary">—</span>
                  )}
                </td>

                {/* Impressions */}
                <td className="px-4 py-3 text-right font-display font-bold text-sf-text-primary">
                  {impressions > 0 ? impressions.toLocaleString() : <span className="text-sf-text-secondary font-normal">—</span>}
                </td>

                {/* Clicks */}
                <td className="px-4 py-3 text-right font-display font-bold text-sf-text-primary">
                  {clicks > 0 ? clicks.toLocaleString() : <span className="text-sf-text-secondary font-normal">—</span>}
                </td>

                {/* Engagement rate */}
                <td className="px-4 py-3 text-right font-display font-bold text-sf-text-primary">
                  {engRate > 0 ? (
                    `${(engRate * 100).toFixed(2)}%`
                  ) : (
                    <span className="text-sf-text-secondary font-normal">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
