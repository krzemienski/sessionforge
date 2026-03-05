"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Sparkles, FileText, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContent } from "@/hooks/use-content";
import { useRecommendations, useAcceptRecommendation, useDismissRecommendation } from "@/hooks/use-recommendations";
import { RecommendationCard, type Recommendation } from "@/components/content/recommendation-card";

const STATUS_DOT: Record<string, string> = {
  draft: "bg-sf-info",
  published: "bg-sf-success",
  archived: "bg-sf-text-muted",
};

const TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog",
  twitter_thread: "Thread",
  linkedin_post: "LinkedIn",
  changelog: "Changelog",
  newsletter: "Newsletter",
  devto_post: "Dev.to",
  custom: "Custom",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarPost {
  id: string;
  title: string;
  status: string;
  contentType: string;
  date: Date;
}

interface CalendarSlot {
  recommendation: Recommendation;
  date: Date;
}

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: CalendarPost[];
  slots: CalendarSlot[];
}

interface CalendarViewProps {
  workspace: string;
  className?: string;
}

function buildCalendarDays(year: number, month: number, posts: CalendarPost[], slots: CalendarSlot[]): DayCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOffset = firstDay.getDay();
  const cells: DayCell[] = [];

  // Fill leading days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    cells.push({ date, isCurrentMonth: false, isToday: false, posts: [], slots: [] });
  }

  // Fill current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toDateString();

    const dayPosts = posts.filter((p) => p.date.toDateString() === dateStr);
    const daySlots = slots.filter((s) => s.date.toDateString() === dateStr);

    cells.push({
      date,
      isCurrentMonth: true,
      isToday: date.toDateString() === today.toDateString(),
      posts: dayPosts,
      slots: daySlots,
    });
  }

  // Fill trailing days from next month to complete the grid (always 6 rows)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d);
    cells.push({ date, isCurrentMonth: false, isToday: false, posts: [], slots: [] });
  }

  return cells;
}

function formatMonthYear(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}

export function CalendarView({ workspace, className }: CalendarViewProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);

  const content = useContent(workspace, { limit: 200 });
  const recommendations = useRecommendations(workspace, { status: "active", limit: 50 });
  const acceptRecommendation = useAcceptRecommendation();
  const dismissRecommendation = useDismissRecommendation();

  const posts: CalendarPost[] = useMemo(() => {
    const raw: any[] = content.data?.posts ?? [];
    return raw
      .map((p) => {
        const dateVal = p.publishedAt ?? p.updatedAt ?? p.createdAt;
        if (!dateVal) return null;
        const date = new Date(dateVal);
        if (isNaN(date.getTime())) return null;
        return { id: p.id, title: p.title, status: p.status, contentType: p.contentType, date };
      })
      .filter(Boolean) as CalendarPost[];
  }, [content.data]);

  const slots: CalendarSlot[] = useMemo(() => {
    const raw: any[] = recommendations.data?.recommendations ?? [];
    return raw
      .filter((r) => r.suggestedPublishTime)
      .map((r) => {
        const date = new Date(r.suggestedPublishTime);
        if (isNaN(date.getTime())) return null;
        const numericPriority: number = typeof r.priority === "number" ? r.priority : 0;
        const priority: Recommendation["priority"] =
          numericPriority >= 70 ? "high" : numericPriority >= 40 ? "medium" : "low";
        const recommendation: Recommendation = {
          id: r.id,
          title: r.title,
          reasoning: r.reasoning,
          suggestedPublishTime: r.suggestedPublishTime,
          contentType: r.suggestedContentType ?? r.contentType,
          insightScore: r.insightScore,
          priority,
        };
        return { recommendation, date };
      })
      .filter(Boolean) as CalendarSlot[];
  }, [recommendations.data]);

  const days = useMemo(
    () => buildCalendarDays(viewYear, viewMonth, posts, slots),
    [viewYear, viewMonth, posts, slots]
  );

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(null);
  }

  function handleDayClick(cell: DayCell) {
    if (!cell.isCurrentMonth) return;
    setSelectedDay((prev) =>
      prev?.date.toDateString() === cell.date.toDateString() ? null : cell
    );
  }

  function handleAccept(id: string) {
    acceptRecommendation.mutate(id);
    if (selectedDay) {
      setSelectedDay((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          slots: prev.slots.filter((s) => s.recommendation.id !== id),
        };
      });
    }
  }

  function handleDismiss(id: string) {
    dismissRecommendation.mutate(id);
    if (selectedDay) {
      setSelectedDay((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          slots: prev.slots.filter((s) => s.recommendation.id !== id),
        };
      });
    }
  }

  const totalSlots = slots.length;
  const totalPosts = posts.filter((p) => {
    const d = p.date;
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  }).length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-sf text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-bg-hover transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-base font-semibold text-sf-text-primary min-w-[160px] text-center">
            {formatMonthYear(viewYear, viewMonth)}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-sf text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-bg-hover transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-sf-text-muted">
          <span className="flex items-center gap-1.5">
            <FileText size={12} />
            {totalPosts} post{totalPosts !== 1 ? "s" : ""} this month
          </span>
          {totalSlots > 0 && (
            <span className="flex items-center gap-1.5 text-sf-accent">
              <Sparkles size={12} />
              {totalSlots} AI suggestion{totalSlots !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border border-sf-border rounded-sf-lg overflow-hidden">
        {/* Day name headers */}
        <div className="grid grid-cols-7 border-b border-sf-border bg-sf-bg-tertiary">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="py-2 text-center text-xs font-medium text-sf-text-muted"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((cell, idx) => {
            const isSelected =
              selectedDay?.date.toDateString() === cell.date.toDateString();
            const hasContent = cell.posts.length > 0 || cell.slots.length > 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDayClick(cell)}
                disabled={!cell.isCurrentMonth}
                className={cn(
                  "relative min-h-[80px] p-1.5 text-left border-b border-r border-sf-border transition-colors",
                  // Remove right border from last column and bottom border from last row
                  (idx + 1) % 7 === 0 && "border-r-0",
                  idx >= 35 && "border-b-0",
                  cell.isCurrentMonth
                    ? "bg-sf-bg-primary hover:bg-sf-bg-hover cursor-pointer"
                    : "bg-sf-bg-tertiary cursor-default",
                  isSelected && "bg-sf-accent-bg border-sf-accent/30",
                  cell.isToday && !isSelected && "bg-sf-bg-secondary"
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full mb-1",
                    cell.isToday
                      ? "bg-sf-accent text-sf-bg-primary font-semibold"
                      : cell.isCurrentMonth
                      ? "text-sf-text-primary"
                      : "text-sf-text-muted"
                  )}
                >
                  {cell.date.getDate()}
                </span>

                {/* Post indicators */}
                <div className="space-y-0.5">
                  {cell.posts.slice(0, 2).map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-1 px-1 py-0.5 rounded bg-sf-bg-secondary border border-sf-border"
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          STATUS_DOT[post.status] ?? "bg-sf-text-muted"
                        )}
                      />
                      <span className="text-xs text-sf-text-secondary truncate leading-none">
                        {post.title || TYPE_LABELS[post.contentType] || "Untitled"}
                      </span>
                    </div>
                  ))}
                  {cell.posts.length > 2 && (
                    <p className="text-xs text-sf-text-muted px-1">
                      +{cell.posts.length - 2} more
                    </p>
                  )}

                  {/* AI suggestion indicators */}
                  {cell.slots.slice(0, 1).map((slot) => (
                    <div
                      key={slot.recommendation.id}
                      className="flex items-center gap-1 px-1 py-0.5 rounded bg-sf-accent/5 border border-sf-accent/20"
                    >
                      <Sparkles size={10} className="text-sf-accent flex-shrink-0" />
                      <span className="text-xs text-sf-accent truncate leading-none">
                        {slot.recommendation.title}
                      </span>
                    </div>
                  ))}
                  {cell.slots.length > 1 && (
                    <p className="text-xs text-sf-accent/70 px-1">
                      +{cell.slots.length - 1} suggestion{cell.slots.length - 1 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Dot indicator for days with content (when truncated) */}
                {hasContent && !cell.isCurrentMonth && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-sf-text-muted" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <div className="border border-sf-border rounded-sf-lg bg-sf-bg-secondary p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-sf-text-muted" />
            <h3 className="text-sm font-semibold text-sf-text-primary">
              {new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(selectedDay.date)}
            </h3>
          </div>

          {selectedDay.posts.length === 0 && selectedDay.slots.length === 0 && (
            <p className="text-sm text-sf-text-muted">No posts or suggestions for this day.</p>
          )}

          {selectedDay.posts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-sf-text-muted uppercase tracking-wide">
                Posts
              </p>
              {selectedDay.posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-2 p-3 rounded-sf bg-sf-bg-tertiary border border-sf-border"
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      STATUS_DOT[post.status] ?? "bg-sf-text-muted"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sf-text-primary truncate">
                      {post.title || "Untitled"}
                    </p>
                    <p className="text-xs text-sf-text-muted">
                      {TYPE_LABELS[post.contentType] || post.contentType} · {post.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedDay.slots.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-sf-text-muted uppercase tracking-wide">
                AI Suggestions
              </p>
              {selectedDay.slots.map((slot) => (
                <RecommendationCard
                  key={slot.recommendation.id}
                  recommendation={slot.recommendation}
                  onAccept={handleAccept}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-sf-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sf-success" />
          Published
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sf-info" />
          Draft
        </span>
        <span className="flex items-center gap-1.5">
          <Sparkles size={10} className="text-sf-accent" />
          AI Suggested Slot
        </span>
      </div>
    </div>
  );
}
