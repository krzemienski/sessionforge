"use client";

import { useState, useEffect } from "react";
import { Calendar, X, Clock, RefreshCw } from "lucide-react";
import { useSchedulePost, useReschedulePost } from "@/hooks/use-schedule";
import { useFocusTrap } from "@/hooks/use-focus-trap";

// Convert a date/time in the selected timezone to a UTC ISO string
function toUTCFromTimezone(date: string, time: string, tz: string): string {
  // Treat the user's input as UTC to get a reference instant
  const inputAsUTC = new Date(`${date}T${time}:00Z`);

  // Find what the target timezone shows for this UTC instant
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(inputAsUTC);
  const get = (type: string) => {
    const v = parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
    return isNaN(v) ? 0 : v;
  };

  // Parse what the timezone shows as a UTC reference point
  const h = get("hour") % 24; // guard against '24' returned for midnight in some Intl impls
  const tzShownAsUTC = new Date(
    `${String(get("year")).padStart(4, "0")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(get("minute")).padStart(2, "0")}:${String(get("second")).padStart(2, "0")}Z`
  );

  // The offset between what the timezone shows and true UTC
  const offsetMs = inputAsUTC.getTime() - tzShownAsUTC.getTime();

  // Apply the offset to get the correct UTC instant
  return new Date(inputAsUTC.getTime() + offsetMs).toISOString();
}

interface ScheduleModalProps {
  postId: string;
  workspace: string;
  isOpen: boolean;
  onClose: () => void;
  existingSchedule?: {
    scheduledFor: string;
    timezone: string;
  };
}

// Common timezones for content publishing
const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/Rome", label: "Rome" },
  { value: "Europe/Stockholm", label: "Stockholm" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "India" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Australia/Melbourne", label: "Melbourne" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

export function ScheduleModal({
  postId,
  workspace,
  isOpen,
  onClose,
  existingSchedule,
}: ScheduleModalProps) {
  const focusTrapRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen, onEscape: onClose });
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [platforms, setPlatforms] = useState<string[]>(["devto"]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schedule = useSchedulePost();
  const reschedule = useReschedulePost();
  const isRescheduling = !!existingSchedule;
  const isPending = isRescheduling ? reschedule.isPending : schedule.isPending;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (existingSchedule) {
        // Parse existing schedule
        const dt = new Date(existingSchedule.scheduledFor);
        const localDate = dt.toISOString().split("T")[0];
        const localTime = dt.toTimeString().slice(0, 5);
        setDate(localDate);
        setTime(localTime);
        setTimezone(existingSchedule.timezone);
      } else {
        // Default to tomorrow at 9 AM user's local timezone
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        setDate(tomorrow.toISOString().split("T")[0]);
        setTime("09:00");
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      }
      setPlatforms(["devto"]);
      setErrorMessage(null);
    }
  }, [isOpen, existingSchedule]);

  if (!isOpen) return null;

  function togglePlatform(platform: string) {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  async function handleSubmit() {
    setErrorMessage(null);

    if (!date || !time) {
      setErrorMessage("Please select both date and time");
      return;
    }

    if (platforms.length === 0) {
      setErrorMessage("Please select at least one platform");
      return;
    }

    try {
      // Convert the user's input (date/time in the selected timezone) to UTC
      const utcDateTime = toUTCFromTimezone(date, time, timezone);

      if (isRescheduling) {
        await reschedule.mutateAsync({
          postId,
          scheduledFor: utcDateTime,
          timezone,
          platforms,
        });
      } else {
        await schedule.mutateAsync({
          postId,
          workspaceSlug: workspace,
          scheduledFor: utcDateTime,
          timezone,
          platforms,
        });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }

  const isSuccess = isRescheduling ? reschedule.isSuccess : schedule.isSuccess;
  const minDate = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label={existingSchedule ? "Reschedule post" : "Schedule post"} className="relative z-10 w-full max-w-md bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold font-display text-sf-text-primary">
            {existingSchedule ? "Reschedule Post" : "Schedule Post"}
          </h2>
          <button
            onClick={onClose}
            className="text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {isSuccess ? (
          /* Success state */
          <div className="space-y-4">
            <p className="text-sm text-sf-success font-medium">
              {existingSchedule
                ? "Post rescheduled successfully."
                : "Post scheduled successfully."}
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form state */
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                <Calendar size={14} className="inline mr-1" />
                Publish Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minDate}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                <Clock size={14} className="inline mr-1" />
                Publish Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-2">
                Publish to
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={platforms.includes("devto")}
                    onChange={() => togglePlatform("devto")}
                    className="w-4 h-4 rounded border-sf-border bg-sf-bg-tertiary text-sf-accent focus:ring-sf-accent focus:ring-offset-0"
                  />
                  <span className="text-sm text-sf-text-primary">Dev.to</span>
                </label>
              </div>
            </div>

            {/* Error */}
            {errorMessage && (
              <p className="text-sm text-sf-error">{errorMessage}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-sf text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Calendar size={14} />
                )}
                {isPending
                  ? "Scheduling..."
                  : existingSchedule
                  ? "Reschedule"
                  : "Schedule"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
