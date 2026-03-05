"use client";

import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS, ShortcutDefinition } from "@/lib/keyboard-shortcuts";

const KEY_DISPLAY: Record<string, string> = {
  Enter: "↵",
  Escape: "Esc",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

function getKeyLabels(shortcut: ShortcutDefinition): string[] {
  const parts: string[] = [];
  if (shortcut.metaKey) parts.push("⌘");
  if (shortcut.ctrlKey) parts.push("⌃");
  if (shortcut.altKey) parts.push("⌥");
  if (shortcut.shiftKey) parts.push("⇧");
  parts.push(KEY_DISPLAY[shortcut.key] ?? shortcut.key.toUpperCase());
  return parts;
}

export function ShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useKeyboardShortcut(
    { key: "/", metaKey: true, description: "Show Keyboard Shortcuts", category: "Help" },
    toggle
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-sf-bg-primary/80 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg mx-4",
          "bg-sf-bg-secondary border border-sf-border rounded-[var(--radius-sf-lg)]",
          "shadow-[var(--shadow-sf-lg)]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sf-border">
          <h2 className="text-sf-text-primary font-display text-sm font-semibold">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={close}
            className="text-sf-text-muted hover:text-sf-text-secondary transition-colors"
            aria-label="Close keyboard shortcuts"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcut list */}
        <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {Object.entries(SHORTCUTS).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-sf-text-muted font-body text-xs uppercase tracking-wider mb-3">
                {category}
              </h3>
              <ul className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <li
                    key={`${shortcut.category}-${shortcut.key}-${shortcut.shiftKey ?? ""}`}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sf-text-secondary font-body text-sm">
                      {shortcut.description}
                    </span>
                    <span className="flex items-center gap-1">
                      {getKeyLabels(shortcut).map((label, i) => (
                        <kbd
                          key={i}
                          className={cn(
                            "inline-flex items-center justify-center",
                            "min-w-[1.5rem] px-1.5 py-0.5 rounded",
                            "bg-sf-bg-tertiary border border-sf-border",
                            "text-sf-text-secondary font-code text-xs",
                            "shadow-[var(--shadow-sf-sm)]"
                          )}
                        >
                          {label}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-sf-border">
          <p className="text-sf-text-muted font-body text-xs text-center">
            Press <kbd className="inline-flex items-center px-1 py-0.5 rounded bg-sf-bg-tertiary border border-sf-border text-xs font-code">Esc</kbd> or <kbd className="inline-flex items-center px-1 py-0.5 rounded bg-sf-bg-tertiary border border-sf-border text-xs font-code">⌘/</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
