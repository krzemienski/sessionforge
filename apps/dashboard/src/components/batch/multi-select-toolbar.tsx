"use client";

import { CheckSquare, X, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function MultiSelectToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  children,
  className,
}: MultiSelectToolbarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-[var(--shadow-sf-lg)]",
        className
      )}
    >
      <span className="text-sm font-medium text-sf-text-primary">
        {selectedCount} selected
      </span>

      <div className="h-4 w-px bg-sf-border" />

      <button
        onClick={onSelectAll}
        disabled={allSelected}
        className={cn(
          "flex items-center gap-1.5 text-sm transition-colors",
          allSelected
            ? "text-sf-text-tertiary cursor-default"
            : "text-sf-text-secondary hover:text-sf-text-primary"
        )}
      >
        <CheckSquare size={14} className="flex-shrink-0" />
        Select All
        {!allSelected && (
          <span className="text-sf-text-tertiary">({totalCount})</span>
        )}
      </button>

      <button
        onClick={onClearSelection}
        className="flex items-center gap-1.5 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
      >
        <Square size={14} className="flex-shrink-0" />
        Clear
      </button>

      {children && (
        <>
          <div className="h-4 w-px bg-sf-border" />
          <div className="flex items-center gap-2">{children}</div>
        </>
      )}

      <button
        onClick={onClearSelection}
        className="ml-auto flex items-center justify-center w-6 h-6 rounded text-sf-text-tertiary hover:text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors"
        aria-label="Dismiss selection"
      >
        <X size={14} />
      </button>
    </div>
  );
}
