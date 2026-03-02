const DAY_NAMES: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

const MONTH_NAMES: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

function resolveValue(
  str: string,
  names?: Record<string, number>
): number | null {
  if (names) {
    const upper = str.toUpperCase();
    if (upper in names) return names[upper];
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

function parseField(
  field: string,
  min: number,
  max: number,
  names?: Record<string, number>
): Set<number> | "wildcard" | "error" {
  if (field === "*") return "wildcard";

  const values = new Set<number>();

  for (const part of field.split(",")) {
    const slashIdx = part.indexOf("/");
    const rangePart = slashIdx >= 0 ? part.slice(0, slashIdx) : part;
    const stepStr = slashIdx >= 0 ? part.slice(slashIdx + 1) : undefined;
    const step = stepStr !== undefined ? parseInt(stepStr, 10) : 1;

    if (stepStr !== undefined && (isNaN(step) || step < 1)) return "error";

    if (rangePart === "*") {
      for (let i = min; i <= max; i += step) values.add(i);
    } else if (rangePart.includes("-")) {
      const dashIdx = rangePart.indexOf("-");
      const start = resolveValue(rangePart.slice(0, dashIdx), names);
      const end = resolveValue(rangePart.slice(dashIdx + 1), names);
      if (start === null || end === null) return "error";
      if (start < min || end > max || start > end) return "error";
      for (let i = start; i <= end; i += step) values.add(i);
    } else {
      let val = resolveValue(rangePart, names);
      if (val === null) return "error";
      // Normalize: 7 (Sunday alias used by some cron impls) -> 0
      if (val === 7 && min === 0 && max === 6) val = 0;
      if (val < min || val > max) return "error";
      values.add(val);
    }
  }

  return values.size > 0 ? values : "error";
}

/**
 * Compute the next scheduled run time for a 5-field cron expression.
 * Supports: minute hour day-of-month month day-of-week
 * Day-of-week accepts 0-7 (0 and 7 = Sunday) or SUN/MON/TUE/WED/THU/FRI/SAT.
 * Month accepts 1-12 or JAN-DEC.
 * Returns null if the expression is invalid or no match found within 1 year.
 */
export function getNextRunTime(cronExpression: string): Date | null {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minField, hourField, domField, monthField, dowField] = parts;

  const minuteResult = parseField(minField, 0, 59);
  const hourResult = parseField(hourField, 0, 23);
  const domResult = parseField(domField, 1, 31);
  const monthResult = parseField(monthField, 1, 12, MONTH_NAMES);
  const dowResult = parseField(dowField, 0, 6, DAY_NAMES);

  if (
    minuteResult === "error" ||
    hourResult === "error" ||
    domResult === "error" ||
    monthResult === "error" ||
    dowResult === "error"
  ) {
    return null;
  }

  const minuteSet = minuteResult === "wildcard" ? null : minuteResult;
  const hourSet = hourResult === "wildcard" ? null : hourResult;
  const domSet = domResult === "wildcard" ? null : domResult;
  const monthSet = monthResult === "wildcard" ? null : monthResult;
  const dowSet = dowResult === "wildcard" ? null : dowResult;

  const now = new Date();
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() + 1);

  while (candidate < limit) {
    // Check month (1-12)
    const month = candidate.getMonth() + 1;
    if (monthSet !== null && !monthSet.has(month)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    // Check day — if both dom and dow are restricted, either can match (OR semantics)
    const dom = candidate.getDate();
    const dow = candidate.getDay(); // 0=Sunday
    let dayMatch: boolean;
    if (domSet === null && dowSet === null) {
      dayMatch = true;
    } else if (domSet !== null && dowSet !== null) {
      dayMatch = domSet.has(dom) || dowSet.has(dow);
    } else if (domSet !== null) {
      dayMatch = domSet.has(dom);
    } else {
      // dowSet is non-null, domSet is null
      dayMatch = dowSet!.has(dow);
    }

    if (!dayMatch) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    // Check hour (0-23)
    const hour = candidate.getHours();
    if (hourSet !== null && !hourSet.has(hour)) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }

    // Check minute (0-59)
    const minute = candidate.getMinutes();
    if (minuteSet !== null && !minuteSet.has(minute)) {
      candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
      continue;
    }

    return new Date(candidate);
  }

  return null;
}

/**
 * Format a next-run Date into a human-readable string for display.
 * Short durations use relative format; longer durations use absolute format.
 */
export function formatNextRun(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return "now";
  if (diffMins < 60)
    return `in ${diffMins} minute${diffMins !== 1 ? "s" : ""}`;

  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24)
    return `in ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;

  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
