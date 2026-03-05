import { describe, it, expect } from "bun:test";
import { getNextRunTime, formatNextRun } from "../cron-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `date` satisfies the given cron field for minutes.
 */
function matchesMinute(date: Date, field: string): boolean {
  const m = date.getMinutes();
  if (field === "*") return true;
  return field.split(",").some((part) => {
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      return m >= lo && m <= hi;
    }
    if (part.includes("/")) {
      const [base, step] = part.split("/");
      const s = Number(step);
      const start = base === "*" ? 0 : Number(base);
      if ((m - start) % s !== 0) return false;
      return m >= start;
    }
    return m === Number(part);
  });
}

/**
 * Returns true if `date` satisfies the given cron field for hours.
 */
function matchesHour(date: Date, field: string): boolean {
  const h = date.getHours();
  if (field === "*") return true;
  return field.split(",").some((part) => {
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      return h >= lo && h <= hi;
    }
    if (part.includes("/")) {
      const [base, step] = part.split("/");
      const s = Number(step);
      const start = base === "*" ? 0 : Number(base);
      return h >= start && (h - start) % s === 0;
    }
    return h === Number(part);
  });
}

/**
 * Returns true if `date` satisfies the given cron field for day-of-month.
 */
function matchesDom(date: Date, field: string): boolean {
  const d = date.getDate();
  if (field === "*") return true;
  return field.split(",").some((part) => {
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      return d >= lo && d <= hi;
    }
    return d === Number(part);
  });
}

/**
 * Returns true if `date` satisfies the given cron field for month.
 */
function matchesMonth(date: Date, field: string): boolean {
  const mo = date.getMonth() + 1;
  if (field === "*") return true;
  return field.split(",").some((part) => mo === Number(part));
}

/**
 * Returns true if `date` satisfies the given cron field for day-of-week.
 */
function matchesDow(date: Date, field: string): boolean {
  const dow = date.getDay(); // 0 = Sunday
  if (field === "*") return true;
  return field.split(",").some((part) => {
    const n = Number(part);
    return dow === (n === 7 ? 0 : n);
  });
}

// ---------------------------------------------------------------------------
// getNextRunTime
// ---------------------------------------------------------------------------

describe("getNextRunTime", () => {
  // -------------------------------------------------------------------------
  // Invalid expressions
  // -------------------------------------------------------------------------

  describe("invalid expressions", () => {
    it("returns null for an empty string", () => {
      expect(getNextRunTime("")).toBeNull();
    });

    it("returns null for fewer than 5 fields", () => {
      expect(getNextRunTime("* * * *")).toBeNull();
    });

    it("returns null for more than 5 fields", () => {
      expect(getNextRunTime("* * * * * *")).toBeNull();
    });

    it("returns null for an out-of-range minute (60)", () => {
      expect(getNextRunTime("60 * * * *")).toBeNull();
    });

    it("returns null for an out-of-range minute (-1)", () => {
      expect(getNextRunTime("-1 * * * *")).toBeNull();
    });

    it("returns null for an out-of-range hour (24)", () => {
      expect(getNextRunTime("* 24 * * *")).toBeNull();
    });

    it("returns null for an out-of-range day-of-month (0)", () => {
      expect(getNextRunTime("* * 0 * *")).toBeNull();
    });

    it("returns null for an out-of-range day-of-month (32)", () => {
      expect(getNextRunTime("* * 32 * *")).toBeNull();
    });

    it("returns null for an out-of-range month (0)", () => {
      expect(getNextRunTime("* * * 0 *")).toBeNull();
    });

    it("returns null for an out-of-range month (13)", () => {
      expect(getNextRunTime("* * * 13 *")).toBeNull();
    });

    it("returns null for an out-of-range day-of-week (8)", () => {
      expect(getNextRunTime("* * * * 8")).toBeNull();
    });

    it("returns null for an invalid step of 0", () => {
      expect(getNextRunTime("*/0 * * * *")).toBeNull();
    });

    it("returns null for a non-numeric minute field", () => {
      expect(getNextRunTime("abc * * * *")).toBeNull();
    });

    it("returns null for a range where start > end", () => {
      expect(getNextRunTime("30-10 * * * *")).toBeNull();
    });

    it("returns null for an invalid named month", () => {
      expect(getNextRunTime("* * * XYZ *")).toBeNull();
    });

    it("returns null for an invalid named day-of-week", () => {
      expect(getNextRunTime("* * * * XYZ")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Wildcard expressions
  // -------------------------------------------------------------------------

  describe("wildcard expressions", () => {
    it("returns a Date (not null) for '* * * * *'", () => {
      const result = getNextRunTime("* * * * *");
      expect(result).toBeInstanceOf(Date);
    });

    it("returns a date in the future for '* * * * *'", () => {
      const result = getNextRunTime("* * * * *");
      expect(result!.getTime()).toBeGreaterThan(Date.now());
    });

    it("returns approximately 1 minute from now for '* * * * *'", () => {
      const result = getNextRunTime("* * * * *");
      const diffMs = result!.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(0);
      // Next run is at most 2 minutes away (candidate starts at now+1min)
      expect(diffMs).toBeLessThanOrEqual(2 * 60 * 1000);
    });

    it("seconds are always 0 for '* * * * *'", () => {
      const result = getNextRunTime("* * * * *");
      expect(result!.getSeconds()).toBe(0);
      expect(result!.getMilliseconds()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Specific minute field
  // -------------------------------------------------------------------------

  describe("specific minute field", () => {
    it("returns a date at minute 0 for '0 * * * *'", () => {
      const result = getNextRunTime("0 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getMinutes()).toBe(0);
    });

    it("returns a date at minute 30 for '30 * * * *'", () => {
      const result = getNextRunTime("30 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getMinutes()).toBe(30);
    });

    it("returns a date at minute 59 for '59 * * * *'", () => {
      const result = getNextRunTime("59 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getMinutes()).toBe(59);
    });
  });

  // -------------------------------------------------------------------------
  // Specific hour field
  // -------------------------------------------------------------------------

  describe("specific hour field", () => {
    it("returns a date at hour 0 for '0 0 * * *'", () => {
      const result = getNextRunTime("0 0 * * *");
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(0);
      expect(result!.getMinutes()).toBe(0);
    });

    it("returns a date at hour 12 for '0 12 * * *'", () => {
      const result = getNextRunTime("0 12 * * *");
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(12);
    });

    it("returns a date at hour 23 for '0 23 * * *'", () => {
      const result = getNextRunTime("0 23 * * *");
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(23);
    });
  });

  // -------------------------------------------------------------------------
  // Step expressions
  // -------------------------------------------------------------------------

  describe("step expressions", () => {
    it("returns a date whose minute is divisible by 5 for '*/5 * * * *'", () => {
      const result = getNextRunTime("*/5 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getMinutes() % 5).toBe(0);
    });

    it("returns a date whose minute is divisible by 15 for '*/15 * * * *'", () => {
      const result = getNextRunTime("*/15 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getMinutes() % 15).toBe(0);
    });

    it("returns a date whose hour is even for '0 */2 * * *'", () => {
      const result = getNextRunTime("0 */2 * * *");
      expect(result).not.toBeNull();
      expect(result!.getHours() % 2).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Range expressions
  // -------------------------------------------------------------------------

  describe("range expressions", () => {
    it("returns a date with minute in 0-30 for '0-30 * * * *'", () => {
      const result = getNextRunTime("0-30 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getMinutes()).toBeGreaterThanOrEqual(0);
      expect(result!.getMinutes()).toBeLessThanOrEqual(30);
    });

    it("returns a date with hour in 9-17 for '0 9-17 * * *'", () => {
      const result = getNextRunTime("0 9-17 * * *");
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBeGreaterThanOrEqual(9);
      expect(result!.getHours()).toBeLessThanOrEqual(17);
    });
  });

  // -------------------------------------------------------------------------
  // Comma-separated values
  // -------------------------------------------------------------------------

  describe("comma-separated values", () => {
    it("returns a date at minute 0 or 30 for '0,30 * * * *'", () => {
      const result = getNextRunTime("0,30 * * * *");
      expect(result).not.toBeNull();
      expect([0, 30]).toContain(result!.getMinutes());
    });

    it("returns a date at hour 6, 12, or 18 for '0 6,12,18 * * *'", () => {
      const result = getNextRunTime("0 6,12,18 * * *");
      expect(result).not.toBeNull();
      expect([6, 12, 18]).toContain(result!.getHours());
    });
  });

  // -------------------------------------------------------------------------
  // Day-of-month field
  // -------------------------------------------------------------------------

  describe("day-of-month field", () => {
    it("returns a date on day 1 for '0 0 1 * *'", () => {
      const result = getNextRunTime("0 0 1 * *");
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(1);
    });

    it("returns a date on day 15 for '0 0 15 * *'", () => {
      const result = getNextRunTime("0 0 15 * *");
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(15);
    });

    it("returns a date within days 1-7 for '0 0 1-7 * *'", () => {
      const result = getNextRunTime("0 0 1-7 * *");
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBeGreaterThanOrEqual(1);
      expect(result!.getDate()).toBeLessThanOrEqual(7);
    });
  });

  // -------------------------------------------------------------------------
  // Month field (numeric)
  // -------------------------------------------------------------------------

  describe("month field — numeric", () => {
    it("returns a date in January for '0 0 1 1 *'", () => {
      const result = getNextRunTime("0 0 1 1 *");
      expect(result).not.toBeNull();
      expect(result!.getMonth() + 1).toBe(1);
    });

    it("returns a date in December for '0 0 1 12 *'", () => {
      const result = getNextRunTime("0 0 1 12 *");
      expect(result).not.toBeNull();
      expect(result!.getMonth() + 1).toBe(12);
    });
  });

  // -------------------------------------------------------------------------
  // Month field (named)
  // -------------------------------------------------------------------------

  describe("month field — named abbreviations", () => {
    it("accepts 'JAN' and returns a date in January for '0 0 1 JAN *'", () => {
      const result = getNextRunTime("0 0 1 JAN *");
      expect(result).not.toBeNull();
      expect(result!.getMonth() + 1).toBe(1);
    });

    it("accepts lowercase 'jan' for '0 0 1 jan *'", () => {
      const result = getNextRunTime("0 0 1 jan *");
      expect(result).not.toBeNull();
      expect(result!.getMonth() + 1).toBe(1);
    });

    it("accepts 'DEC' and returns a date in December for '0 0 1 DEC *'", () => {
      const result = getNextRunTime("0 0 1 DEC *");
      expect(result).not.toBeNull();
      expect(result!.getMonth() + 1).toBe(12);
    });

    it("accepts 'JUN' and returns a date in June for '0 0 1 JUN *'", () => {
      const result = getNextRunTime("0 0 1 JUN *");
      expect(result).not.toBeNull();
      expect(result!.getMonth() + 1).toBe(6);
    });
  });

  // -------------------------------------------------------------------------
  // Day-of-week field (numeric)
  // -------------------------------------------------------------------------

  describe("day-of-week field — numeric", () => {
    it("returns a Sunday for '0 0 * * 0'", () => {
      const result = getNextRunTime("0 0 * * 0");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(0);
    });

    it("returns a Monday for '0 0 * * 1'", () => {
      const result = getNextRunTime("0 0 * * 1");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(1);
    });

    it("returns a Saturday for '0 0 * * 6'", () => {
      const result = getNextRunTime("0 0 * * 6");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(6);
    });

    it("treats 7 as Sunday (alias) for '0 0 * * 7'", () => {
      const result = getNextRunTime("0 0 * * 7");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Day-of-week field (named)
  // -------------------------------------------------------------------------

  describe("day-of-week field — named abbreviations", () => {
    it("accepts 'SUN' and returns a Sunday for '0 0 * * SUN'", () => {
      const result = getNextRunTime("0 0 * * SUN");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(0);
    });

    it("accepts 'MON' and returns a Monday for '0 0 * * MON'", () => {
      const result = getNextRunTime("0 0 * * MON");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(1);
    });

    it("accepts 'FRI' and returns a Friday for '0 0 * * FRI'", () => {
      const result = getNextRunTime("0 0 * * FRI");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(5);
    });

    it("accepts 'SAT' and returns a Saturday for '0 0 * * SAT'", () => {
      const result = getNextRunTime("0 0 * * SAT");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(6);
    });

    it("accepts lowercase 'mon' for '0 0 * * mon'", () => {
      const result = getNextRunTime("0 0 * * mon");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // DOM + DOW OR semantics
  // -------------------------------------------------------------------------

  describe("DOM and DOW OR semantics", () => {
    it("returns a date that matches either the specified DOM or DOW", () => {
      // Day 1 or Sunday
      const result = getNextRunTime("0 0 1 * 0");
      expect(result).not.toBeNull();
      const dom = result!.getDate();
      const dow = result!.getDay();
      expect(dom === 1 || dow === 0).toBe(true);
    });

    it("returns a date on the given DOM when DOW wildcard", () => {
      const result = getNextRunTime("0 0 1 * *");
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(1);
    });

    it("returns a date on the given DOW when DOM wildcard", () => {
      const result = getNextRunTime("0 0 * * 1");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Return value properties
  // -------------------------------------------------------------------------

  describe("return value properties", () => {
    it("always returns a Date with seconds = 0", () => {
      const result = getNextRunTime("*/10 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getSeconds()).toBe(0);
    });

    it("always returns a Date with milliseconds = 0", () => {
      const result = getNextRunTime("*/10 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getMilliseconds()).toBe(0);
    });

    it("returns a date strictly in the future", () => {
      const before = Date.now();
      const result = getNextRunTime("* * * * *");
      expect(result!.getTime()).toBeGreaterThan(before);
    });

    it("handles leading and trailing whitespace in the expression", () => {
      const result = getNextRunTime("  * * * * *  ");
      expect(result).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  // Common cron presets
  // -------------------------------------------------------------------------

  describe("common cron presets", () => {
    it("@hourly equivalent '0 * * * *' returns next hour boundary", () => {
      const result = getNextRunTime("0 * * * *");
      expect(result).not.toBeNull();
      expect(result!.getMinutes()).toBe(0);
      expect(result!.getSeconds()).toBe(0);
    });

    it("@daily equivalent '0 0 * * *' returns midnight", () => {
      const result = getNextRunTime("0 0 * * *");
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(0);
      expect(result!.getMinutes()).toBe(0);
    });

    it("@weekly equivalent '0 0 * * 0' returns a Sunday midnight", () => {
      const result = getNextRunTime("0 0 * * 0");
      expect(result).not.toBeNull();
      expect(result!.getDay()).toBe(0);
      expect(result!.getHours()).toBe(0);
      expect(result!.getMinutes()).toBe(0);
    });

    it("@monthly equivalent '0 0 1 * *' returns the 1st of the month at midnight", () => {
      const result = getNextRunTime("0 0 1 * *");
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(1);
      expect(result!.getHours()).toBe(0);
      expect(result!.getMinutes()).toBe(0);
    });

    it("business hours '0 9 * * 1-5' returns a weekday at 09:00", () => {
      const result = getNextRunTime("0 9 * * 1-5");
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(9);
      expect(result!.getMinutes()).toBe(0);
      const dow = result!.getDay();
      expect(dow).toBeGreaterThanOrEqual(1);
      expect(dow).toBeLessThanOrEqual(5);
    });
  });
});

// ---------------------------------------------------------------------------
// formatNextRun
// ---------------------------------------------------------------------------

describe("formatNextRun", () => {
  // -------------------------------------------------------------------------
  // "now" threshold (< 1 minute)
  // -------------------------------------------------------------------------

  describe("'now' threshold", () => {
    it("returns 'now' when the date is exactly now", () => {
      const date = new Date();
      expect(formatNextRun(date)).toBe("now");
    });

    it("returns 'now' when the date is 10 seconds in the future", () => {
      // Math.round(10000 / 60000) = Math.round(0.167) = 0, so diffMins < 1 → "now"
      const date = new Date(Date.now() + 10 * 1000);
      expect(formatNextRun(date)).toBe("now");
    });

    it("returns 'now' when the date is 29 seconds in the future", () => {
      // Math.round(29000 / 60000) = Math.round(0.483) = 0, so diffMins < 1 → "now"
      const date = new Date(Date.now() + 29 * 1000);
      expect(formatNextRun(date)).toBe("now");
    });

    it("returns 'now' when the date is in the past", () => {
      const date = new Date(Date.now() - 5000);
      expect(formatNextRun(date)).toBe("now");
    });
  });

  // -------------------------------------------------------------------------
  // Minute relative format
  // -------------------------------------------------------------------------

  describe("minute relative format", () => {
    it("returns 'in 1 minute' (singular) for ~1 minute from now", () => {
      const date = new Date(Date.now() + 60 * 1000);
      expect(formatNextRun(date)).toBe("in 1 minute");
    });

    it("returns 'in 2 minutes' (plural) for ~2 minutes from now", () => {
      const date = new Date(Date.now() + 2 * 60 * 1000);
      expect(formatNextRun(date)).toBe("in 2 minutes");
    });

    it("returns 'in 30 minutes' for ~30 minutes from now", () => {
      const date = new Date(Date.now() + 30 * 60 * 1000);
      expect(formatNextRun(date)).toBe("in 30 minutes");
    });

    it("returns 'in 59 minutes' for ~59 minutes from now", () => {
      const date = new Date(Date.now() + 59 * 60 * 1000);
      expect(formatNextRun(date)).toBe("in 59 minutes");
    });

    it("uses 'minute' singular only for exactly 1 minute", () => {
      const date = new Date(Date.now() + 60 * 1000);
      const result = formatNextRun(date);
      expect(result).toMatch(/^in 1 minute$/);
      expect(result).not.toContain("minutes");
    });
  });

  // -------------------------------------------------------------------------
  // Hour relative format
  // -------------------------------------------------------------------------

  describe("hour relative format", () => {
    it("returns 'in 1 hour' (singular) for ~1 hour from now", () => {
      const date = new Date(Date.now() + 60 * 60 * 1000);
      expect(formatNextRun(date)).toBe("in 1 hour");
    });

    it("returns 'in 2 hours' (plural) for ~2 hours from now", () => {
      const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
      expect(formatNextRun(date)).toBe("in 2 hours");
    });

    it("returns 'in 12 hours' for ~12 hours from now", () => {
      const date = new Date(Date.now() + 12 * 60 * 60 * 1000);
      expect(formatNextRun(date)).toBe("in 12 hours");
    });

    it("returns 'in 23 hours' for ~23 hours from now", () => {
      const date = new Date(Date.now() + 23 * 60 * 60 * 1000);
      expect(formatNextRun(date)).toBe("in 23 hours");
    });

    it("uses 'hour' singular only for exactly 1 hour", () => {
      const date = new Date(Date.now() + 60 * 60 * 1000);
      const result = formatNextRun(date);
      expect(result).toMatch(/^in 1 hour$/);
      expect(result).not.toContain("hours");
    });
  });

  // -------------------------------------------------------------------------
  // Absolute date format (>= 24 hours)
  // -------------------------------------------------------------------------

  describe("absolute date format", () => {
    it("returns a non-empty string for a date 24 hours from now", () => {
      const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = formatNextRun(date);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("does not return a relative 'in N hours' string for 24 hours", () => {
      const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = formatNextRun(date);
      expect(result).not.toMatch(/^in \d+ hours?$/);
    });

    it("returns a string that does not start with 'in' for 2 days from now", () => {
      const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const result = formatNextRun(date);
      expect(result.startsWith("in")).toBe(false);
    });

    it("returns a string that does not start with 'in' for 7 days from now", () => {
      const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const result = formatNextRun(date);
      expect(result.startsWith("in")).toBe(false);
    });

    it("returns a string containing time digits (hours:minutes) for far-future dates", () => {
      const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const result = formatNextRun(date);
      // Intl.DateTimeFormat with time always includes digits separated by colon or similar
      expect(result).toMatch(/\d/);
    });
  });

  // -------------------------------------------------------------------------
  // Return type
  // -------------------------------------------------------------------------

  describe("return type", () => {
    it("always returns a string", () => {
      const dates = [
        new Date(Date.now() + 30 * 1000),
        new Date(Date.now() + 2 * 60 * 1000),
        new Date(Date.now() + 2 * 60 * 60 * 1000),
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      ];
      for (const d of dates) {
        expect(typeof formatNextRun(d)).toBe("string");
      }
    });
  });
});
