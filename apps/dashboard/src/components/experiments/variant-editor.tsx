"use client";

import { FlaskConical, Type, FileText, Percent, Shield } from "lucide-react";

export interface VariantData {
  label: string;
  headlineText: string;
  hookText: string;
  trafficAllocation: number; // stored as 0-1
  isControl: boolean;
}

interface VariantEditorProps {
  variant: VariantData;
  onChange: (updated: VariantData) => void;
  disabled?: boolean;
}

export function VariantEditor({
  variant,
  onChange,
  disabled = false,
}: VariantEditorProps) {
  function handleChange<K extends keyof VariantData>(
    field: K,
    value: VariantData[K]
  ) {
    onChange({ ...variant, [field]: value });
  }

  function handleTrafficChange(displayValue: string) {
    const parsed = parseFloat(displayValue);
    if (isNaN(parsed)) return;
    // Clamp between 0 and 100, store as 0-1
    const clamped = Math.min(100, Math.max(0, parsed));
    handleChange("trafficAllocation", clamped / 100);
  }

  // Display traffic allocation as 0-100%
  const trafficDisplay = Math.round(variant.trafficAllocation * 100);

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-5 space-y-4">
      {/* Header with control badge */}
      <div className="flex items-center gap-2">
        <FlaskConical size={16} className="text-sf-accent" />
        <span className="text-sm font-semibold font-display text-sf-text-primary">
          {variant.label || "Untitled Variant"}
        </span>
        {variant.isControl && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-sf-info bg-sf-bg-tertiary border border-sf-border px-2 py-0.5 rounded-sf-full">
            <Shield size={10} />
            Control
          </span>
        )}
      </div>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-sf-text-secondary mb-1">
          <Type size={14} className="inline mr-1" />
          Label
        </label>
        <input
          type="text"
          value={variant.label}
          onChange={(e) => handleChange("label", e.target.value)}
          disabled={disabled}
          placeholder="e.g. Variant A"
          className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Headline Text */}
      <div>
        <label className="block text-sm font-medium text-sf-text-secondary mb-1">
          <Type size={14} className="inline mr-1" />
          Headline Text
        </label>
        <input
          type="text"
          value={variant.headlineText}
          onChange={(e) => handleChange("headlineText", e.target.value)}
          disabled={disabled}
          placeholder="Enter headline for this variant"
          className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Hook Text */}
      <div>
        <label className="block text-sm font-medium text-sf-text-secondary mb-1">
          <FileText size={14} className="inline mr-1" />
          Hook Text
        </label>
        <textarea
          value={variant.hookText}
          onChange={(e) => handleChange("hookText", e.target.value)}
          disabled={disabled}
          placeholder="Opening paragraph or social hook for this variant"
          rows={3}
          className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Traffic Allocation */}
      <div>
        <label className="block text-sm font-medium text-sf-text-secondary mb-1">
          <Percent size={14} className="inline mr-1" />
          Traffic Allocation
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={trafficDisplay}
            onChange={(e) => handleTrafficChange(e.target.value)}
            disabled={disabled}
            min={0}
            max={100}
            step={1}
            className="w-24 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-sf-text-muted">%</span>
        </div>
      </div>

      {/* Is Control Toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={variant.isControl}
            onChange={(e) => handleChange("isControl", e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-sf-border bg-sf-bg-tertiary text-sf-accent focus:ring-sf-accent focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-sf-text-primary">
            Mark as control variant
          </span>
        </label>
        <p className="text-xs text-sf-text-muted mt-1 ml-6">
          The control variant uses the original content for baseline comparison.
        </p>
      </div>
    </div>
  );
}
