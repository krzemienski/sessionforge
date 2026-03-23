"use client";

import { useEffect, useRef, useCallback } from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseFocusTrapOptions {
  /** Whether the focus trap is active. Typically tied to the modal's open state. */
  enabled?: boolean;
  /** Called when Escape is pressed inside the trap. */
  onEscape?: () => void;
}

/**
 * Traps keyboard focus within a container element.
 *
 * When enabled:
 * - Focus moves to the first focusable element on mount
 * - Tab / Shift+Tab cycle within the container
 * - Escape calls `onEscape` and restores focus to the previously-focused element
 *
 * Returns a ref to attach to the container element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions = {}
) {
  const { enabled = true, onEscape } = options;
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the element that had focus before the trap activated
  useEffect(() => {
    if (enabled) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    }
  }, [enabled]);

  // Focus the first focusable element when the trap activates
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    // Small delay to ensure the modal DOM is rendered
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        // If no focusable children, focus the container itself
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  // Restore focus on unmount or when disabled
  useEffect(() => {
    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !containerRef.current) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );

      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [enabled, onEscape]
  );

  // Attach the keydown listener to the container
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return containerRef;
}
