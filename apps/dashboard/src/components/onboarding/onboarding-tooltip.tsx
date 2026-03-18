"use client";

import { useEffect, useRef, useState } from "react";

type OnboardingTooltipProps = {
  content: string;
};

export function OnboardingTooltip({ content }: OnboardingTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="More information"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-5 h-5 rounded-full border border-sf-border bg-sf-bg-tertiary text-sf-text-muted hover:border-sf-border-focus hover:text-sf-text-secondary flex items-center justify-center text-xs font-medium transition-colors focus:outline-none"
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute left-7 top-1/2 -translate-y-1/2 z-50 w-56 bg-sf-bg-secondary border border-sf-border rounded-sf p-3 shadow-lg text-xs text-sf-text-secondary leading-relaxed"
        >
          {content}
          {/* Arrow */}
          <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-sf-bg-secondary border-l border-b border-sf-border rotate-45" />
        </div>
      )}
    </div>
  );
}
