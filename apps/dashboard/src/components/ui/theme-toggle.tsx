"use client";

import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { ThemeMode } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const CYCLE: ThemeMode[] = ["system", "light", "dark"];

const THEME_CONFIG: Record<
  ThemeMode,
  { icon: React.ElementType; label: string }
> = {
  system: { icon: Monitor, label: "System" },
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  function cycleTheme() {
    const idx = CYCLE.indexOf(theme);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setTheme(next);
  }

  const { icon: Icon, label } = THEME_CONFIG[theme];

  return (
    <div className={cn("relative group inline-flex", className)}>
      <button
        onClick={cycleTheme}
        aria-label={`Theme: ${label}. Click to cycle theme`}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-sf",
          "text-sf-text-muted hover:text-sf-text-secondary",
          "hover:bg-sf-bg-hover transition-colors"
        )}
      >
        <Icon size={16} />
      </button>

      {/* Tooltip */}
      <span
        className={cn(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1",
          "rounded-sf text-xs font-display whitespace-nowrap pointer-events-none",
          "bg-sf-bg-secondary border border-sf-border text-sf-text-primary",
          "shadow-[var(--shadow-sf-lg)]",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        )}
      >
        {label}
      </span>
    </div>
  );
}
