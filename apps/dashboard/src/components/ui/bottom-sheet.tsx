"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Snap points as fractions of viewport height (0-1). Defaults to [0.5, 0.9]. */
  snapPoints?: number[];
  /** Title displayed in the sheet header. */
  title?: string;
  /** Additional classes for the sheet content container. */
  className?: string;
  children: React.ReactNode;
}

const DRAG_DISMISS_THRESHOLD = 100; // px downward drag to dismiss
const DRAG_VELOCITY_THRESHOLD = 500; // px/s to dismiss via flick

export function BottomSheet({
  isOpen,
  onClose,
  snapPoints = [0.5, 0.9],
  title,
  className,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startY: number;
    startTranslate: number;
    lastY: number;
    lastTime: number;
  } | null>(null);

  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Manage open/close animation
  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger CSS transition after mount
      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
        setCurrentSnapIndex(0);
        setTranslateY(0);
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Focus trapping
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return;

    const sheet = sheetRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = sheet.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    // Focus the sheet on open
    const previouslyFocused = document.activeElement as HTMLElement | null;
    sheet.focus();

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  const getSheetHeight = useCallback(() => {
    return window.innerHeight * (snapPoints[currentSnapIndex] ?? 0.5);
  }, [snapPoints, currentSnapIndex]);

  const handleDragStart = useCallback(
    (clientY: number) => {
      setIsDragging(true);
      dragState.current = {
        startY: clientY,
        startTranslate: translateY,
        lastY: clientY,
        lastTime: Date.now(),
      };
    },
    [translateY]
  );

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragState.current) return;

    const deltaY = clientY - dragState.current.startY;
    // Only allow dragging downward (positive) or slight upward for snap
    const newTranslate = dragState.current.startTranslate + deltaY;
    setTranslateY(Math.max(-50, newTranslate)); // Allow slight upward for bounce feel

    dragState.current.lastY = clientY;
    dragState.current.lastTime = Date.now();
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragState.current) return;

    const velocity =
      ((dragState.current.lastY - dragState.current.startY) /
        Math.max(1, Date.now() - dragState.current.lastTime)) *
      1000;

    const currentTranslate = translateY;

    // Dismiss if dragged far enough down or flicked down fast
    if (
      currentTranslate > DRAG_DISMISS_THRESHOLD ||
      velocity > DRAG_VELOCITY_THRESHOLD
    ) {
      onClose();
    } else if (currentTranslate < -30 && currentSnapIndex < snapPoints.length - 1) {
      // Snap to next (larger) snap point on upward drag
      setCurrentSnapIndex((prev) => Math.min(prev + 1, snapPoints.length - 1));
      setTranslateY(0);
    } else {
      // Snap back
      setTranslateY(0);
    }

    setIsDragging(false);
    dragState.current = null;
  }, [translateY, onClose, currentSnapIndex, snapPoints.length]);

  // Touch handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleDragStart(e.touches[0].clientY);
    },
    [handleDragStart]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleDragMove(e.touches[0].clientY);
    },
    [handleDragMove]
  );

  const onTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Mouse handlers for desktop testing
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleDragStart(e.clientY);
    },
    [handleDragStart]
  );

  useEffect(() => {
    if (!isDragging) return;

    function onMouseMove(e: MouseEvent) {
      handleDragMove(e.clientY);
    }
    function onMouseUp() {
      handleDragEnd();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (!isOpen) return null;

  const sheetHeight = getSheetHeight();

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Bottom sheet"}
        tabIndex={-1}
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-sf-bg-secondary border-t border-sf-border rounded-t-2xl flex flex-col outline-none",
          !isDragging && "transition-transform duration-300 ease-out",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
        style={{
          height: `${sheetHeight}px`,
          transform: isVisible
            ? `translateY(${Math.max(0, translateY)}px)`
            : "translateY(100%)",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 pt-3 pb-2 cursor-grab active:cursor-grabbing select-none touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          aria-hidden="true"
        >
          <div className="w-10 h-1 bg-sf-text-muted/30 rounded-full mx-auto" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 pb-3">
            <span className="text-sm font-medium text-sf-text-primary">
              {title}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-sf-text-muted hover:text-sf-text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain px-4 pb-4",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
