"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Sparkles, FileText, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSwipeGesture } from "@/hooks/use-swipe-gesture";
import {
  STATUS_DOT,
  TYPE_LABELS,
  DAY_NAMES,
  type CalendarPost,
  type CalendarSlot,
  type DayCell,
} from "@/components/content/calendar-utils";

interface MobileWeekCalendarProps {
  posts: CalendarPost[];
  slots: CalendarSlot[];
  onDaySelect?: (day: DayCell) => void;
  className?: string;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function buildWeekDays(weekStart: Date, posts: CalendarPost[], slots: CalendarSlot[]): DayCell[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
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

  return cells;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startMonth = new Intl.DateTimeFormat("en-US", { month: "short" }).format(weekStart);
  const endMonth = new Intl.DateTimeFormat("en-US", { month: "short" }).format(weekEnd);

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  }
  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
}

export function MobileWeekCalendar({ posts, slots, onDaySelect, className }: MobileWeekCalendarProps) {
  const now = new Date();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(now));
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const days = useMemo(
    () => buildWeekDays(weekStart, posts, slots),
    [weekStart, posts, slots]
  );

  const prevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
    setSelectedDay(null);
  }, []);

  const nextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
    setSelectedDay(null);
  }, []);

  useSwipeGesture(containerRef, (event) => {
    if (event.direction === "left") {
      nextWeek();
    } else if (event.direction === "right") {
      prevWeek();
    }
  }, {
    directions: ["left", "right"],
  });

  function handleDayTap(cell: DayCell) {
    const isSameDay = selectedDay?.date.toDateString() === cell.date.toDateString();
    const newSelection = isSameDay ? null : cell;
    setSelectedDay(newSelection);
    if (newSelection && onDaySelect) {
      onDaySelect(newSelection);
    }
  }

  const weekPostCount = days.reduce((sum, d) => sum + d.posts.length, 0);
  const weekSlotCount = days.reduce((sum, d) => sum + d.slots.length, 0);

  return (
    <div className={cn("space-y-3", className)} ref={containerRef}>
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="p-2 rounded-sf text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-bg-hover transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Previous week"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-sm font-semibold text-sf-text-primary min-w-[180px] text-center">
            {formatWeekRange(weekStart)}
          </h2>
          <button
            onClick={nextWeek}
            className="p-2 rounded-sf text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-bg-hover transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Next week"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Week summary badges */}
      <div className="flex items-center gap-3 text-xs text-sf-text-muted">
        <span className="flex items-center gap-1.5">
          <FileText size={12} />
          {weekPostCount} post{weekPostCount !== 1 ? "s" : ""}
        </span>
        {weekSlotCount > 0 && (
          <span className="flex items-center gap-1.5 text-sf-accent">
            <Sparkles size={12} />
            {weekSlotCount} suggestion{weekSlotCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Week grid — horizontally scrollable */}
      <div className="overflow-x-auto -mx-1 px-1 scrollbar-none">
        <div className="grid grid-cols-7 gap-1 min-w-[320px]">
          {days.map((cell, idx) => {
            const isSelected = selectedDay?.date.toDateString() === cell.date.toDateString();
            const postCount = cell.posts.length;
            const slotCount = cell.slots.length;
            const hasContent = postCount > 0 || slotCount > 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDayTap(cell)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-1 rounded-sf-lg transition-colors touch-manipulation min-w-[44px]",
                  isSelected
                    ? "bg-sf-accent-bg border border-sf-accent/30"
                    : "bg-sf-bg-secondary border border-transparent hover:bg-sf-bg-hover",
                  cell.isToday && !isSelected && "border-sf-accent/50"
                )}
                aria-label={`${DAY_NAMES[idx]}, ${new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                }).format(cell.date)}${postCount > 0 ? `, ${postCount} post${postCount !== 1 ? "s" : ""}` : ""}${slotCount > 0 ? `, ${slotCount} suggestion${slotCount !== 1 ? "s" : ""}` : ""}`}
              >
                {/* Day name */}
                <span className="text-xs text-sf-text-muted font-medium">
                  {DAY_NAMES[idx]}
                </span>

                {/* Day number */}
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-full",
                    cell.isToday
                      ? "bg-sf-accent text-sf-bg-primary font-semibold"
                      : "text-sf-text-primary"
                  )}
                >
                  {cell.date.getDate()}
                </span>

                {/* Count badges */}
                {hasContent && (
                  <div className="flex items-center gap-0.5">
                    {postCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium rounded-full bg-sf-bg-tertiary text-sf-text-secondary border border-sf-border">
                        {postCount}
                      </span>
                    )}
                    {slotCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium rounded-full bg-sf-accent/10 text-sf-accent border border-sf-accent/20">
                        {slotCount}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day drill-down */}
      {selectedDay && (
        <div className="border border-sf-border rounded-sf-lg bg-sf-bg-secondary p-3 space-y-3">
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
                <div
                  key={slot.recommendation.id}
                  className="flex items-center gap-2 p-3 rounded-sf bg-sf-accent/5 border border-sf-accent/20"
                >
                  <Sparkles size={14} className="text-sf-accent flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sf-accent truncate">
                      {slot.recommendation.title}
                    </p>
                    {slot.recommendation.contentType && (
                      <p className="text-xs text-sf-text-muted">
                        {TYPE_LABELS[slot.recommendation.contentType] || slot.recommendation.contentType}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { MobileWeekCalendarProps };
