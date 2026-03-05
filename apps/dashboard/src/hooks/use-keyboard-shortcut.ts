"use client";

import { useEffect, useCallback } from "react";
import { matchesShortcut, ShortcutDefinition } from "@/lib/keyboard-shortcuts";

interface UseKeyboardShortcutOptions {
  disabled?: boolean;
  captureInInputs?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  if (target.getAttribute("contenteditable") !== null) return true;
  return false;
}

export function useKeyboardShortcut(
  shortcut: ShortcutDefinition,
  handler: (e: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions = {}
): void {
  const { disabled = false, captureInInputs = false } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      if (!captureInInputs && isEditableTarget(e.target)) return;
      if (!matchesShortcut(e, shortcut)) return;
      e.preventDefault();
      handler(e);
    },
    [shortcut, handler, disabled, captureInInputs]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
