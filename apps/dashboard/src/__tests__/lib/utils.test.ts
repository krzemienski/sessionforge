import { describe, it, expect, vi, afterEach } from "vitest";
import { cn, formatDate, formatDuration, timeAgo } from "@/lib/utils";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles a single class string", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", undefined, null, false, "bar")).toBe("foo bar");
  });

  it("handles conditional object syntax", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });

  it("handles arrays of classes", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("resolves tailwind conflicts by keeping the last class", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("resolves tailwind padding conflicts", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("preserves non-conflicting tailwind classes", () => {
    const result = cn("text-sm", "font-bold");
    expect(result).toContain("text-sm");
    expect(result).toContain("font-bold");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });

  it("returns empty string for all falsy arguments", () => {
    expect(cn(undefined, null, false)).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats 0 seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats seconds under 60", () => {
    expect(formatDuration(1)).toBe("1s");
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("formats exactly 60 seconds as 1m", () => {
    expect(formatDuration(60)).toBe("1m");
  });

  it("formats minutes between 1 and 59", () => {
    expect(formatDuration(90)).toBe("2m");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(3599)).toBe("60m");
  });

  it("rounds to the nearest minute", () => {
    expect(formatDuration(89)).toBe("1m");
    expect(formatDuration(91)).toBe("2m");
  });

  it("formats exactly 1 hour", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(7200)).toBe("2h 0m");
    expect(formatDuration(7260)).toBe("2h 1m");
  });

  it("formats large durations correctly", () => {
    // 2 hours 30 minutes = 9000 seconds
    expect(formatDuration(9000)).toBe("2h 30m");
  });

  it("rounds minutes within an hour", () => {
    // 3600 + 90 = 3690 seconds → 1h, 90s → round(90/60) = 2m → 1h 2m
    expect(formatDuration(3690)).toBe("1h 2m");
  });
});

describe("timeAgo", () => {
  const NOW = 1700000000000; // fixed timestamp for deterministic tests

  it("returns 'just now' for time within the last 60 seconds", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(timeAgo(new Date(NOW - 30 * 1000))).toBe("just now");
    expect(timeAgo(new Date(NOW - 59 * 1000))).toBe("just now");
    expect(timeAgo(new Date(NOW))).toBe("just now");
  });

  it("returns 'just now' for 0ms ago", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(timeAgo(new Date(NOW))).toBe("just now");
  });

  it("returns minutes ago for time between 1 and 59 minutes", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(timeAgo(new Date(NOW - 60 * 1000))).toBe("1m ago");
    expect(timeAgo(new Date(NOW - 5 * 60 * 1000))).toBe("5m ago");
    expect(timeAgo(new Date(NOW - 59 * 60 * 1000))).toBe("59m ago");
  });

  it("returns hours ago for time between 1 and 23 hours", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(timeAgo(new Date(NOW - 60 * 60 * 1000))).toBe("1h ago");
    expect(timeAgo(new Date(NOW - 3 * 60 * 60 * 1000))).toBe("3h ago");
    expect(timeAgo(new Date(NOW - 23 * 60 * 60 * 1000))).toBe("23h ago");
  });

  it("returns days ago for time 24 hours or more", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(timeAgo(new Date(NOW - 24 * 60 * 60 * 1000))).toBe("1d ago");
    expect(timeAgo(new Date(NOW - 7 * 24 * 60 * 60 * 1000))).toBe("7d ago");
    expect(timeAgo(new Date(NOW - 30 * 24 * 60 * 60 * 1000))).toBe("30d ago");
  });

  it("accepts a date string as input", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const dateStr = new Date(NOW - 2 * 60 * 1000).toISOString();
    expect(timeAgo(dateStr)).toBe("2m ago");
  });

  it("accepts a Date object as input", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const date = new Date(NOW - 3 * 60 * 60 * 1000);
    expect(timeAgo(date)).toBe("3h ago");
  });
});

describe("formatDate", () => {
  const NOW = new Date("2024-06-15T12:00:00.000Z").getTime();

  it("formats a date from today as 'today'", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(formatDate(new Date(NOW))).toBe("today");
  });

  it("formats a date from yesterday as 'yesterday'", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const yesterday = new Date(NOW - 86400000);
    expect(formatDate(yesterday)).toBe("yesterday");
  });

  it("formats a date from tomorrow as 'tomorrow'", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const tomorrow = new Date(NOW + 86400000);
    expect(formatDate(tomorrow)).toBe("tomorrow");
  });

  it("formats a past date in days", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const threeDaysAgo = new Date(NOW - 3 * 86400000);
    expect(formatDate(threeDaysAgo)).toBe("3 days ago");
  });

  it("formats a future date in days", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const inFiveDays = new Date(NOW + 5 * 86400000);
    expect(formatDate(inFiveDays)).toBe("in 5 days");
  });

  it("accepts a date string as input", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(formatDate(new Date(NOW).toISOString())).toBe("today");
  });

  it("accepts a Date object as input", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(formatDate(new Date(NOW))).toBe("today");
  });
});
