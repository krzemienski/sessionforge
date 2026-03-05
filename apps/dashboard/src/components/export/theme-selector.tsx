"use client";

import { Check } from "lucide-react";

export const EXPORT_THEMES = [
  {
    id: "minimal-portfolio",
    label: "Minimal Portfolio",
    description: "Clean, developer-focused portfolio with dark mode support",
    accentColor: "#6366f1",
    previewLines: [
      { width: "60%", height: 10, dark: true },
      { width: "40%", height: 6, dark: false },
      { width: "80%", height: 6, dark: false },
      { width: "55%", height: 6, dark: false },
    ],
  },
  {
    id: "technical-blog",
    label: "Technical Blog",
    description:
      "Reading-optimized layout with table of contents and syntax highlighting",
    accentColor: "#10b981",
    previewLines: [
      { width: "70%", height: 8, dark: true },
      { width: "90%", height: 5, dark: false },
      { width: "85%", height: 5, dark: false },
      { width: "30%", height: 5, dark: false },
    ],
  },
  {
    id: "changelog",
    label: "Changelog",
    description:
      "Timeline-based release notes with version grouping and badges",
    accentColor: "#f59e0b",
    previewLines: [
      { width: "30%", height: 7, dark: true },
      { width: "75%", height: 5, dark: false },
      { width: "65%", height: 5, dark: false },
      { width: "50%", height: 5, dark: false },
    ],
  },
] as const;

export type ExportThemeId = (typeof EXPORT_THEMES)[number]["id"];

interface ThemeSelectorProps {
  value: ExportThemeId;
  onChange: (theme: ExportThemeId) => void;
}

function ThemePreview({
  theme,
  selected,
}: {
  theme: (typeof EXPORT_THEMES)[number];
  selected: boolean;
}) {
  return (
    <div
      className={`w-full h-20 rounded-sf-sm border overflow-hidden flex flex-col gap-1 p-2 transition-colors ${
        selected ? "border-sf-accent" : "border-sf-border"
      }`}
      style={{ backgroundColor: "var(--sf-bg-primary, #0d0d0d)" }}
    >
      {/* Top accent bar */}
      <div
        className="h-0.5 w-full rounded-full opacity-80"
        style={{ backgroundColor: theme.accentColor }}
      />

      {/* Simulated content lines */}
      <div className="flex flex-col gap-1 mt-0.5 flex-1 justify-center">
        {theme.previewLines.map((line, i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: line.width,
              height: line.height,
              backgroundColor: line.dark
                ? theme.accentColor
                : "var(--sf-border, rgba(255,255,255,0.1))",
              opacity: line.dark ? 0.9 : 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {EXPORT_THEMES.map((theme) => {
        const selected = value === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            className={`relative flex flex-col gap-2 text-left rounded-sf border p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent ${
              selected
                ? "border-sf-accent bg-sf-accent/5"
                : "border-sf-border bg-sf-bg-tertiary hover:border-sf-border-focus"
            }`}
            aria-pressed={selected}
            aria-label={`Select ${theme.label} theme`}
          >
            {/* Selected check */}
            {selected && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-sf-accent flex items-center justify-center">
                <Check size={10} className="text-sf-bg-primary" strokeWidth={3} />
              </span>
            )}

            {/* Visual preview */}
            <ThemePreview theme={theme} selected={selected} />

            {/* Label & description */}
            <div className="space-y-0.5">
              <p
                className={`text-xs font-semibold leading-tight ${
                  selected ? "text-sf-text-primary" : "text-sf-text-secondary"
                }`}
              >
                {theme.label}
              </p>
              <p className="text-xs text-sf-text-muted leading-tight line-clamp-2">
                {theme.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
