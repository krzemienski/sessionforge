"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FlaskConical,
  X,
  Plus,
  Trash2,
  Calendar,
  Play,
  Pause,
  Ban,
  RefreshCw,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { VariantEditor, type VariantData } from "./variant-editor";
import dynamic from "next/dynamic";
import type { ExperimentKpi } from "@/lib/experiments/statistics";

const ExperimentResults = dynamic(
  () => import("./experiment-results").then((m) => m.ExperimentResults),
  { ssr: false }
);
import {
  useCreateExperiment,
  useUpdateExperiment,
} from "@/hooks/use-experiments";

// Convert a date/time in the selected timezone to a UTC ISO string
function toUTCFromTimezone(date: string, time: string, tz: string): string {
  const inputAsUTC = new Date(`${date}T${time}:00Z`);
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
  const h = get("hour") % 24;
  const tzShownAsUTC = new Date(
    `${String(get("year")).padStart(4, "0")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(get("minute")).padStart(2, "0")}:${String(get("second")).padStart(2, "0")}Z`
  );
  const offsetMs = inputAsUTC.getTime() - tzShownAsUTC.getTime();
  return new Date(inputAsUTC.getTime() + offsetMs).toISOString();
}

const KPI_OPTIONS = [
  { value: "views", label: "Views" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comments" },
  { value: "shares", label: "Shares" },
  { value: "engagement_rate", label: "Engagement Rate" },
] as const;

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

function defaultVariant(index: number, isControl: boolean): VariantData {
  return {
    label: isControl ? "Control" : `Variant ${String.fromCharCode(65 + index)}`,
    headlineText: "",
    hookText: "",
    trafficAllocation: 0.5,
    isControl,
  };
}

interface ExistingExperiment {
  id: string;
  name: string;
  kpi: string;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string;
  variants?: {
    id: string;
    label: string;
    headlineText: string;
    hookText: string;
    trafficAllocation: number;
    isControl: boolean;
  }[];
}

interface ExperimentSetupPanelProps {
  postId: string;
  workspace: string;
  isOpen: boolean;
  onClose: () => void;
  existingExperiment?: ExistingExperiment;
}

export function ExperimentSetupPanel({
  postId,
  workspace,
  isOpen,
  onClose,
  existingExperiment,
}: ExperimentSetupPanelProps) {
  const [name, setName] = useState("");
  const [kpi, setKpi] = useState<string>("views");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [variants, setVariants] = useState<VariantData[]>([
    defaultVariant(0, true),
    defaultVariant(1, false),
  ]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createExperiment = useCreateExperiment();
  const updateExperiment = useUpdateExperiment();
  const isEditing = !!existingExperiment;
  const isPending = isEditing
    ? updateExperiment.isPending
    : createExperiment.isPending;

  // Reset state when panel opens
  useEffect(() => {
    if (!isOpen) return;

    if (existingExperiment) {
      setName(existingExperiment.name);
      setKpi(existingExperiment.kpi);
      setTimezone(existingExperiment.timezone ?? "UTC");

      if (existingExperiment.startsAt) {
        const dt = new Date(existingExperiment.startsAt);
        setStartDate(dt.toISOString().split("T")[0]);
        setStartTime(dt.toTimeString().slice(0, 5));
      } else {
        setStartDate("");
        setStartTime("");
      }

      if (existingExperiment.endsAt) {
        const dt = new Date(existingExperiment.endsAt);
        setEndDate(dt.toISOString().split("T")[0]);
        setEndTime(dt.toTimeString().slice(0, 5));
      } else {
        setEndDate("");
        setEndTime("");
      }

      if (existingExperiment.variants && existingExperiment.variants.length > 0) {
        setVariants(
          existingExperiment.variants.map((v) => ({
            label: v.label,
            headlineText: v.headlineText,
            hookText: v.hookText,
            trafficAllocation: v.trafficAllocation,
            isControl: v.isControl,
          }))
        );
      } else {
        setVariants([defaultVariant(0, true), defaultVariant(1, false)]);
      }
    } else {
      setName("");
      setKpi("views");
      setStartDate("");
      setStartTime("");
      setEndDate("");
      setEndTime("");
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setVariants([defaultVariant(0, true), defaultVariant(1, false)]);
    }

    setErrorMessage(null);
  }, [isOpen, existingExperiment]);

  // Traffic allocation validation
  const totalTraffic = useMemo(
    () => variants.reduce((sum, v) => sum + v.trafficAllocation, 0),
    [variants]
  );
  const trafficValid = Math.abs(totalTraffic - 1) < 0.001;
  const trafficPercent = Math.round(totalTraffic * 100);

  const hasControl = variants.some((v) => v.isControl);

  // Whether the experiment is in a mutable state
  const experimentStatus = existingExperiment?.status ?? "draft";
  const isLocked =
    experimentStatus === "completed" || experimentStatus === "cancelled";

  if (!isOpen) return null;

  function handleVariantChange(index: number, updated: VariantData) {
    setVariants((prev) => prev.map((v, i) => (i === index ? updated : v)));
  }

  function addVariant() {
    const nextIndex = variants.length;
    setVariants((prev) => [
      ...prev,
      defaultVariant(nextIndex, false),
    ]);
  }

  function removeVariant(index: number) {
    if (variants.length <= 2) {
      setErrorMessage("An experiment requires at least 2 variants.");
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please enter an experiment name.");
      return;
    }

    if (!hasControl) {
      setErrorMessage("At least one variant must be marked as control.");
      return;
    }

    if (!trafficValid) {
      setErrorMessage(
        `Traffic allocation must total 100%. Currently at ${trafficPercent}%.`
      );
      return;
    }

    for (const v of variants) {
      if (!v.label.trim()) {
        setErrorMessage("All variants must have a label.");
        return;
      }
      if (!v.headlineText.trim()) {
        setErrorMessage(`Variant "${v.label}" needs headline text.`);
        return;
      }
      if (!v.hookText.trim()) {
        setErrorMessage(`Variant "${v.label}" needs hook text.`);
        return;
      }
    }

    try {
      const payload: Parameters<typeof createExperiment.mutateAsync>[0] = {
        workspaceSlug: workspace,
        postId,
        name: name.trim(),
        kpi,
        variants: variants.map((v) => ({
          label: v.label.trim(),
          headlineText: v.headlineText.trim(),
          hookText: v.hookText.trim(),
          trafficAllocation: v.trafficAllocation,
          isControl: v.isControl,
        })),
      };

      if (startDate && startTime) {
        payload.startsAt = toUTCFromTimezone(startDate, startTime, timezone);
      }
      if (endDate && endTime) {
        payload.endsAt = toUTCFromTimezone(endDate, endTime, timezone);
      }

      await createExperiment.mutateAsync(payload);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    }
  }

  async function handleUpdate() {
    if (!existingExperiment) return;
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please enter an experiment name.");
      return;
    }

    try {
      const payload: Parameters<typeof updateExperiment.mutateAsync>[0] = {
        id: existingExperiment.id,
        name: name.trim(),
        kpi,
      };

      if (startDate && startTime) {
        payload.startsAt = toUTCFromTimezone(startDate, startTime, timezone);
      }
      if (endDate && endTime) {
        payload.endsAt = toUTCFromTimezone(endDate, endTime, timezone);
      }

      await updateExperiment.mutateAsync(payload);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!existingExperiment) return;
    setErrorMessage(null);

    try {
      await updateExperiment.mutateAsync({
        id: existingExperiment.id,
        status: newStatus,
      });
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    }
  }

  const isSuccess = isEditing
    ? updateExperiment.isSuccess
    : createExperiment.isSuccess;

  const minDate = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FlaskConical size={20} className="text-sf-accent" />
            <h2 className="text-lg font-semibold font-display text-sf-text-primary">
              {isEditing ? "Edit Experiment" : "New A/B Test"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {isSuccess && !isEditing ? (
          /* Success state for creation */
          <div className="space-y-4">
            <p className="text-sm text-sf-success font-medium">
              Experiment created successfully.
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
          <div className="space-y-5">
            {/* Status Badge (editing only) */}
            {isEditing && (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-sf-full border ${
                    experimentStatus === "running"
                      ? "text-sf-success bg-sf-bg-tertiary border-sf-border"
                      : experimentStatus === "paused"
                        ? "text-sf-warning bg-sf-bg-tertiary border-sf-border"
                        : experimentStatus === "completed"
                          ? "text-sf-info bg-sf-bg-tertiary border-sf-border"
                          : experimentStatus === "cancelled"
                            ? "text-sf-error bg-sf-bg-tertiary border-sf-border"
                            : "text-sf-text-secondary bg-sf-bg-tertiary border-sf-border"
                  }`}
                >
                  {experimentStatus.charAt(0).toUpperCase() +
                    experimentStatus.slice(1)}
                </span>
              </div>
            )}

            {/* Experiment Name */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Experiment Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLocked}
                placeholder="e.g. Headline test - March launch post"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* KPI Selector */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                <BarChart3 size={14} className="inline mr-1" />
                Primary KPI
              </label>
              <select
                value={kpi}
                onChange={(e) => setKpi(e.target.value)}
                disabled={isLocked}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {KPI_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Experiment Window */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-sf-text-secondary mb-1">
                <Calendar size={14} className="inline mr-1" />
                Experiment Window
              </legend>

              {/* Start */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-sf-text-muted mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={minDate}
                    disabled={isLocked}
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-sf-text-muted mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isLocked}
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* End */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-sf-text-muted mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || minDate}
                    disabled={isLocked}
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-sf-text-muted mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={isLocked}
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-xs text-sf-text-muted mb-1">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={isLocked}
                  className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>

            {/* Variants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-sf-text-secondary">
                  Variants
                </span>
                {!isLocked && (
                  <button
                    onClick={addVariant}
                    className="inline-flex items-center gap-1 text-xs font-medium text-sf-accent hover:text-sf-accent-dim transition-colors"
                  >
                    <Plus size={14} />
                    Add Variant
                  </button>
                )}
              </div>

              {variants.map((variant, index) => (
                <div key={index} className="relative">
                  <VariantEditor
                    variant={variant}
                    onChange={(updated) => handleVariantChange(index, updated)}
                    disabled={isLocked}
                  />
                  {!isLocked && variants.length > 2 && (
                    <button
                      onClick={() => removeVariant(index)}
                      className="absolute top-3 right-3 text-sf-text-muted hover:text-sf-error transition-colors"
                      aria-label={`Remove ${variant.label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              {/* Traffic Split Validation */}
              {!trafficValid && (
                <div className="flex items-center gap-2 text-sm text-sf-error bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>
                    Traffic allocation totals {trafficPercent}% &mdash; must
                    equal 100%.
                  </span>
                </div>
              )}

              {!hasControl && (
                <div className="flex items-center gap-2 text-sm text-sf-warning bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>At least one variant must be marked as control.</span>
                </div>
              )}
            </div>

            {/* Error */}
            {errorMessage && (
              <p className="text-sm text-sf-error">{errorMessage}</p>
            )}

            {/* Experiment Results (when running/paused/completed) */}
            {isEditing && existingExperiment && (experimentStatus === "running" || experimentStatus === "paused" || experimentStatus === "completed") && (
              <div className="border-t border-sf-border pt-4">
                <ExperimentResults
                  experimentId={existingExperiment.id}
                  kpi={kpi as ExperimentKpi}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-sf-border">
              {/* Status actions (editing only) */}
              <div className="flex items-center gap-2 pt-3">
                {isEditing && experimentStatus === "draft" && (
                  <button
                    onClick={() => handleStatusChange("running")}
                    disabled={isPending || !trafficValid || !hasControl}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-sf-success hover:text-sf-success/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={14} />
                    Start
                  </button>
                )}
                {isEditing && experimentStatus === "running" && (
                  <button
                    onClick={() => handleStatusChange("paused")}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-sf-warning hover:text-sf-warning/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Pause size={14} />
                    Pause
                  </button>
                )}
                {isEditing && experimentStatus === "paused" && (
                  <button
                    onClick={() => handleStatusChange("running")}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-sf-success hover:text-sf-success/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={14} />
                    Resume
                  </button>
                )}
                {isEditing &&
                  (experimentStatus === "draft" ||
                    experimentStatus === "running" ||
                    experimentStatus === "paused") && (
                    <button
                      onClick={() => handleStatusChange("cancelled")}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-sf-error hover:text-sf-error/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Ban size={14} />
                      Cancel
                    </button>
                  )}
              </div>

              {/* Save / Create actions */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  onClick={onClose}
                  disabled={isPending}
                  className="px-4 py-2 rounded-sf text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border transition-colors disabled:opacity-50"
                >
                  Close
                </button>
                {!isLocked && (
                  <button
                    onClick={isEditing ? handleUpdate : handleCreate}
                    disabled={isPending}
                    className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                  >
                    {isPending ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <FlaskConical size={14} />
                    )}
                    {isPending
                      ? "Saving..."
                      : isEditing
                        ? "Update Experiment"
                        : "Create Experiment"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
