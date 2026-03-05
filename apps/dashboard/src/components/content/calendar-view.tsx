"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X, CalendarDays, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContentCalendar } from "@/hooks/use-content";
import { useRouter } from "next/navigation";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_DOT: Record<string, string> = {
  published: "bg-sf-success",
  draft: "bg-sf-warning",
  scheduled: "bg-sf-info",
  missed: "bg-sf-danger",
};

const STATUS_BADGE: Record<string, string> = {
  published: "text-sf-success bg-sf-success/10",
  draft: "text-sf-warning bg-sf-warning/10",
  scheduled: "text-sf-info bg-sf-info/10",
  missed: "text-sf-danger bg-sf-danger/10",
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

interface CalendarEntry {
  id: string;
  title: string;
  status: string;
  contentType: string;
  date: string;
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  // month is 1-based
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function buildWeekGrid(year: number, month: number, week: number): (string | null)[] {
  // week is 0-based index within month grid
  const monthCells = buildMonthGrid(year, month);
  const start = week * 7;
  return monthCells.slice(start, start + 7);
}

function isSameDay(dateStr: string, today: Date): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  return y === today.getFullYear() && m === today.getMonth() + 1 && d === today.getDate();
}

interface DayPanelProps {
  dateStr: string;
  entries: CalendarEntry[];
  onClose: () => void;
  workspace: string;
}

function DayPanel({ dateStr, entries, onClose, workspace }: DayPanelProps) {
  const router = useRouter();
  const [y, m, d] = dateStr.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-sf-bg-secondary border-l border-sf-border h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-sf-border">
          <h2 className="font-semibold text-sf-text-primary">{label}</h2>
          <button
            onClick={onClose}
            className="text-sf-text-muted hover:text-sf-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.length === 0 && (
            <p className="text-sm text-sf-text-muted text-center py-8">No content on this day.</p>
          )}
          {entries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => router.push(`/${workspace}/content/${entry.id}`)}
              className="bg-sf-bg-tertiary border border-sf-border hover:border-sf-border-focus rounded-sf p-3 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-sf-full text-xs font-medium capitalize",
                    STATUS_BADGE[entry.status] || "text-sf-text-muted bg-sf-bg-tertiary"
                  )}
                >
                  {entry.status}
                </span>
                <span className="text-xs text-sf-text-muted">
                  {TYPE_LABELS[entry.contentType] || entry.contentType}
                </span>
              </div>
              <p className="text-sm font-medium text-sf-text-primary line-clamp-2">{entry.title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CalendarViewProps {
  workspace: string;
}

export function CalendarView({ workspace }: CalendarViewProps) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const calendar = useContentCalendar(workspace, year, month);

  // Fix 2: API returns days as a Record<dateKey, { posts: [] }>, not an array.
  const dayMap = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    const daysRecord = (calendar.data?.days ?? {}) as Record<string, { posts: any[] }>;
    for (const [dateKey, dayData] of Object.entries(daysRecord)) {
      map[dateKey] = (dayData.posts ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        contentType: p.contentType,
        date: dateKey,
      }));
    }
    return map;
  }, [calendar.data?.days]);

  // Fix 5: Build a Set of dates that have scheduled automation runs (blue dots).
  const scheduledDates = useMemo(() => {
    const dates = new Set<string>();
    const nextRuns = (calendar.data?.nextRuns ?? {}) as Record<string, string>;
    for (const iso of Object.values(nextRuns)) {
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dates.add(key);
    }
    return dates;
  }, [calendar.data?.nextRuns]);

  const monthCells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const weekCount = Math.ceil(monthCells.length / 7);

  const displayCells = useMemo(() => {
    if (viewMode === "month") return monthCells;
    return buildWeekGrid(year, month, Math.min(weekIndex, weekCount - 1));
  }, [viewMode, monthCells, year, month, weekIndex, weekCount]);

  function prevPeriod() {
    if (viewMode === "month") {
      if (month === 1) { setYear(y => y - 1); setMonth(12); }
      else setMonth(m => m - 1);
      setWeekIndex(0);
    } else {
      if (weekIndex > 0) {
        setWeekIndex(w => w - 1);
      } else {
        // Go to previous month, last week
        let newYear = year;
        let newMonth = month - 1;
        if (newMonth < 1) { newMonth = 12; newYear = year - 1; }
        setYear(newYear);
        setMonth(newMonth);
        const prevCells = buildMonthGrid(newYear, newMonth);
        setWeekIndex(Math.ceil(prevCells.length / 7) - 1);
      }
    }
  }

  function nextPeriod() {
    if (viewMode === "month") {
      if (month === 12) { setYear(y => y + 1); setMonth(1); }
      else setMonth(m => m + 1);
      setWeekIndex(0);
    } else {
      if (weekIndex < weekCount - 1) {
        setWeekIndex(w => w + 1);
      } else {
        // Go to next month
        let newYear = year;
        let newMonth = month + 1;
        if (newMonth > 12) { newMonth = 1; newYear = year + 1; }
        setYear(newYear);
        setMonth(newMonth);
        setWeekIndex(0);
      }
    }
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setWeekIndex(0);
  }

  const selectedEntries = selectedDate ? (dayMap[selectedDate] ?? []) : [];

  const headerLabel = viewMode === "month"
    ? `${MONTH_NAMES[month - 1]} ${year}`
    : (() => {
        const cells = buildWeekGrid(year, month, Math.min(weekIndex, weekCount - 1));
        const first = cells.find(c => c !== null);
        const last = [...cells].reverse().find(c => c !== null);
        if (!first || !last) return `${MONTH_NAMES[month - 1]} ${year}`;
        const [fy, fm, fd] = first.split("-").map(Number);
        const [ly, lm, ld] = last.split("-").map(Number);
        const start = new Date(fy, fm - 1, fd);
        const end = new Date(ly, lm - 1, ld);
        return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      })();

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevPeriod}
            className="p-1.5 rounded-sf text-sf-text-secondary hover:bg-sf-bg-hover transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-sf-text-primary min-w-[180px] text-center">
            {headerLabel}
          </h2>
          <button
            onClick={nextPeriod}
            className="p-1.5 rounded-sf text-sf-text-secondary hover:bg-sf-bg-hover transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={goToday}
            className="ml-2 text-xs px-2.5 py-1 rounded-sf border border-sf-border text-sf-text-secondary hover:bg-sf-bg-hover transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1 bg-sf-bg-tertiary rounded-sf p-0.5">
          <button
            onClick={() => setViewMode("month")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sf transition-colors",
              viewMode === "month"
                ? "bg-sf-bg-secondary text-sf-text-primary shadow-sm"
                : "text-sf-text-secondary hover:text-sf-text-primary"
            )}
          >
            <LayoutGrid size={14} />
            Month
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sf transition-colors",
              viewMode === "week"
                ? "bg-sf-bg-secondary text-sf-text-primary shadow-sm"
                : "text-sf-text-secondary hover:text-sf-text-primary"
            )}
          >
            <CalendarDays size={14} />
            Week
          </button>
        </div>
      </div>

      {/* Fix 4: Streak banner removed — streak is already shown in the content page header.
          The calendar API does not return a streak field, so the banner was always hidden. */}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-sf-text-muted">
        {Object.entries(STATUS_DOT).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full inline-block", cls)} />
            <span className="capitalize">{status}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden">
        {/* Day name headers */}
        <div className="grid grid-cols-7 border-b border-sf-border">
          {DAY_NAMES.map((name) => (
            <div key={name} className="py-2 text-center text-xs font-medium text-sf-text-muted">
              {name}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className={cn("grid grid-cols-7", viewMode === "month" ? "divide-y divide-sf-border" : "")}>
          {displayCells.map((dateStr, idx) => {
            const entries = dateStr ? (dayMap[dateStr] ?? []) : [];
            const isToday = dateStr ? isSameDay(dateStr, today) : false;
            const isSelected = dateStr === selectedDate;
            const dayNum = dateStr ? parseInt(dateStr.split("-")[2], 10) : null;

            // Group entries by status for dots
            const statusCounts: Record<string, number> = {};
            for (const e of entries) {
              statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
            }
            // Fix 5: Add a blue "scheduled" dot if an automation run lands on this date
            if (dateStr && scheduledDates.has(dateStr)) {
              statusCounts["scheduled"] = (statusCounts["scheduled"] || 0) + 1;
            }

            return (
              <div
                key={idx}
                onClick={() => dateStr && setSelectedDate(isSelected ? null : dateStr)}
                className={cn(
                  "min-h-[80px] p-2 transition-colors",
                  dateStr
                    ? "cursor-pointer hover:bg-sf-bg-hover"
                    : "bg-sf-bg-tertiary/30",
                  isSelected && "bg-sf-accent-bg",
                  viewMode === "month" && idx % 7 !== 6 && "border-r border-sf-border",
                  viewMode === "week" && idx !== 6 && "border-r border-sf-border",
                )}
              >
                {dayNum !== null && (
                  <>
                    <div className={cn(
                      "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1.5",
                      isToday
                        ? "bg-sf-accent text-sf-bg-primary"
                        : "text-sf-text-secondary"
                    )}>
                      {dayNum}
                    </div>

                    {/* Content dots */}
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(statusCounts).map(([status, count]) =>
                        Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                          <span
                            key={`${status}-${i}`}
                            className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status] || "bg-sf-text-muted")}
                          />
                        ))
                      )}
                    </div>

                    {/* Show title on week view */}
                    {viewMode === "week" && entries.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {entries.slice(0, 3).map((entry) => (
                          <div
                            key={entry.id}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded truncate",
                              STATUS_BADGE[entry.status] || "text-sf-text-muted bg-sf-bg-tertiary"
                            )}
                          >
                            {entry.title}
                          </div>
                        ))}
                        {entries.length > 3 && (
                          <p className="text-xs text-sf-text-muted">+{entries.length - 3} more</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {calendar.isLoading && (
        <div className="text-center py-4 text-sm text-sf-text-muted">Loading calendar...</div>
      )}

      {/* Day detail slide-in panel */}
      {selectedDate && (
        <DayPanel
          dateStr={selectedDate}
          entries={selectedEntries}
          onClose={() => setSelectedDate(null)}
          workspace={workspace}
        />
      )}
    </div>
  );
}
