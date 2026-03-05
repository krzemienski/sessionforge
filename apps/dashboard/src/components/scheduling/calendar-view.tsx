"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  workspace: string;
}

interface Post {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "published" | "archived";
  scheduledFor?: string | null;
  createdAt: string;
  contentType: string;
  markdown?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  posts: Post[];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function CalendarView({ workspace }: CalendarViewProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Fetch scheduled posts
  const { data: scheduledData, isLoading: scheduledLoading } = useQuery({
    queryKey: ["scheduled-posts", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/schedule?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to fetch scheduled posts");
      return res.json() as Promise<{ posts: Post[] }>;
    },
    enabled: !!workspace,
  });

  // Fetch published posts
  const { data: publishedData, isLoading: publishedLoading } = useQuery({
    queryKey: ["published-posts", workspace],
    queryFn: async () => {
      const res = await fetch(
        `/api/content?workspace=${workspace}&status=published&limit=100`
      );
      if (!res.ok) throw new Error("Failed to fetch published posts");
      return res.json() as Promise<{ posts: Post[] }>;
    },
    enabled: !!workspace,
  });

  const scheduledPosts = scheduledData?.posts ?? [];
  const publishedPosts = publishedData?.posts ?? [];
  const isLoading = scheduledLoading || publishedLoading;

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on Saturday of the week containing the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days: CalendarDay[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateToCheck = new Date(current);
      const isCurrentMonth = dateToCheck.getMonth() === month;

      // Find posts for this day
      const postsForDay = [
        ...scheduledPosts.filter((post) => {
          if (!post.scheduledFor) return false;
          const scheduledDate = new Date(post.scheduledFor);
          return isSameDay(scheduledDate, dateToCheck);
        }),
        ...publishedPosts.filter((post) => {
          const publishedDate = new Date(post.createdAt);
          return isSameDay(publishedDate, dateToCheck);
        }),
      ];

      days.push({
        date: new Date(dateToCheck),
        isCurrentMonth,
        posts: postsForDay,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentDate, scheduledPosts, publishedPosts]);

  const goToPreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handlePostClick = (post: Post) => {
    router.push(`/${workspace}/content/${post.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-sf-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold font-display text-sf-text-primary">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border rounded-sf transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border rounded-sf transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border rounded-sf transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-sf-border rounded-sf-lg overflow-hidden bg-sf-bg-secondary">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-sf-border bg-sf-bg-tertiary">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-semibold text-sf-text-secondary uppercase tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const isToday = isSameDay(day.date, new Date());
            const hasPosts = day.posts.length > 0;

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[120px] border-r border-b border-sf-border last:border-r-0",
                  "[&:nth-last-child(-n+7)]:border-b-0",
                  !day.isCurrentMonth && "bg-sf-bg-tertiary/50"
                )}
              >
                <div className="p-2 h-full flex flex-col">
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        day.isCurrentMonth
                          ? "text-sf-text-primary"
                          : "text-sf-text-muted",
                        isToday &&
                          "w-6 h-6 flex items-center justify-center rounded-full bg-sf-accent text-sf-bg-primary"
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                    {hasPosts && (
                      <span className="text-xs text-sf-text-muted">
                        {day.posts.length}
                      </span>
                    )}
                  </div>

                  {/* Posts for this day */}
                  <div className="space-y-1 flex-1 overflow-y-auto">
                    {day.posts.slice(0, 3).map((post) => (
                      <button
                        key={post.id}
                        onClick={() => handlePostClick(post)}
                        className={cn(
                          "w-full text-left px-2 py-1 rounded text-xs truncate transition-colors",
                          post.status === "scheduled"
                            ? "bg-sf-accent-bg text-sf-accent hover:bg-sf-accent hover:text-sf-bg-primary"
                            : "bg-sf-success/10 text-sf-success hover:bg-sf-success hover:text-sf-bg-primary"
                        )}
                        title={post.title}
                      >
                        {post.title || "Untitled"}
                      </button>
                    ))}
                    {day.posts.length > 3 && (
                      <div className="text-xs text-sf-text-muted px-2">
                        +{day.posts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-sf-accent-bg border border-sf-accent"></div>
          <span className="text-sf-text-secondary">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-sf-success/10 border border-sf-success"></div>
          <span className="text-sf-text-secondary">Published</span>
        </div>
      </div>

      {/* Empty state */}
      {scheduledPosts.length === 0 && publishedPosts.length === 0 && (
        <div className="text-center py-12">
          <Calendar size={40} className="mx-auto text-sf-text-muted mb-3" />
          <h3 className="font-semibold text-sf-text-primary mb-1">
            No scheduled or published posts
          </h3>
          <p className="text-sm text-sf-text-secondary">
            Schedule posts to see them appear on the calendar.
          </p>
        </div>
      )}
    </div>
  );
}
