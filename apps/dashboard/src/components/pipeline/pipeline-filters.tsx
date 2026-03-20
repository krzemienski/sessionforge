"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type DateRange = "7d" | "30d" | "90d" | "all";
export type ContentType =
  | "all"
  | "blog_post"
  | "twitter_thread"
  | "linkedin_post"
  | "changelog"
  | "newsletter";
export type PipelineStatus = "all" | "active" | "failed" | "complete";

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All", value: "all" },
];

const CONTENT_TYPES: { label: string; value: ContentType }[] = [
  { label: "All Types", value: "all" },
  { label: "Blog Post", value: "blog_post" },
  { label: "Twitter Thread", value: "twitter_thread" },
  { label: "LinkedIn Post", value: "linkedin_post" },
  { label: "Changelog", value: "changelog" },
  { label: "Newsletter", value: "newsletter" },
];

const STATUSES: { label: string; value: PipelineStatus }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Failed", value: "failed" },
  { label: "Complete", value: "complete" },
];

export interface PipelineFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (value: DateRange) => void;
  contentType: ContentType;
  onContentTypeChange: (value: ContentType) => void;
  status?: PipelineStatus;
  onStatusChange?: (value: PipelineStatus) => void;
  showStatusFilter?: boolean;
}

export function PipelineFilters({
  dateRange,
  onDateRangeChange,
  contentType,
  onContentTypeChange,
  status = "all",
  onStatusChange,
  showStatusFilter = false,
}: PipelineFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date range buttons */}
      <div className="flex items-center gap-1">
        {DATE_RANGES.map((dr) => (
          <button
            key={dr.value}
            onClick={() => onDateRangeChange(dr.value)}
            className={cn(
              "px-3 py-1.5 rounded-sf text-sm font-medium transition-colors",
              dateRange === dr.value
                ? "bg-sf-accent text-white"
                : "bg-sf-bg-secondary border border-sf-border text-sf-text-secondary hover:border-sf-border-focus"
            )}
          >
            {dr.label}
          </button>
        ))}
      </div>

      {/* Content type dropdown */}
      <div className="relative">
        <select
          value={contentType}
          onChange={(e) => onContentTypeChange(e.target.value as ContentType)}
          className="appearance-none bg-sf-bg-secondary border border-sf-border rounded-sf px-3 py-1.5 pr-8 text-sm font-medium text-sf-text-secondary hover:border-sf-border-focus transition-colors cursor-pointer focus:outline-none focus:border-sf-accent"
        >
          {CONTENT_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>
              {ct.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-sf-text-secondary pointer-events-none"
        />
      </div>

      {/* Optional status filter */}
      {showStatusFilter && onStatusChange && (
        <div className="relative">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as PipelineStatus)}
            className="appearance-none bg-sf-bg-secondary border border-sf-border rounded-sf px-3 py-1.5 pr-8 text-sm font-medium text-sf-text-secondary hover:border-sf-border-focus transition-colors cursor-pointer focus:outline-none focus:border-sf-accent"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sf-text-secondary pointer-events-none"
          />
        </div>
      )}
    </div>
  );
}
