import type { Recommendation } from "@/components/content/recommendation-card";

export const STATUS_DOT: Record<string, string> = {
  draft: "bg-sf-info",
  published: "bg-sf-success",
  archived: "bg-sf-text-muted",
};

export const TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog",
  twitter_thread: "Thread",
  linkedin_post: "LinkedIn",
  changelog: "Changelog",
  newsletter: "Newsletter",
  devto_post: "Dev.to",
  custom: "Custom",
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CalendarPost {
  id: string;
  title: string;
  status: string;
  contentType: string;
  date: Date;
}

export interface CalendarSlot {
  recommendation: Recommendation;
  date: Date;
}

export interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: CalendarPost[];
  slots: CalendarSlot[];
}

export function buildCalendarDays(year: number, month: number, posts: CalendarPost[], slots: CalendarSlot[]): DayCell[] {
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
