"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface SwipeAction {
  /** Label shown during swipe */
  label: string;
  /** Icon element to display */
  icon?: React.ReactNode;
  /** Background color class for the action indicator */
  color: string;
  /** Callback when the swipe action is triggered */
  onAction: () => void;
}

export interface SwipeableCardProps {
  /** Content to render inside the card */
  children: React.ReactNode;
  /** Action revealed when swiping right (e.g., publish) */
  leftAction?: SwipeAction;
  /** Action revealed when swiping left (e.g., archive) */
  rightAction?: SwipeAction;
  /** Minimum swipe distance in px to trigger the action (default: 80) */
  threshold?: number;
  /** Disable swipe interactions */
  disabled?: boolean;
  /** Additional classes for the outer container */
  className?: string;
}

const DEFAULT_THRESHOLD = 80;

export function SwipeableCard({
  children,
  leftAction,
  rightAction,
  threshold = DEFAULT_THRESHOLD,
  disabled = false,
  className,
}: SwipeableCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    locked: boolean;
    axis: "x" | "y" | null;
  } | null>(null);

  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const maxSwipe = 120;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        locked: false,
        axis: null,
      };
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !touchRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchRef.current.startX;
      const deltaY = touch.clientY - touchRef.current.startY;

      // Determine axis lock on first significant movement
      if (!touchRef.current.axis) {
        if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
        touchRef.current.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      }

      // If vertical scroll, don't interfere
      if (touchRef.current.axis === "y") return;

      // Prevent vertical scrolling while swiping horizontally
      touchRef.current.locked = true;
      setIsSwiping(true);
      setIsResetting(false);

      // Constrain offset: only allow right swipe if leftAction exists, left swipe if rightAction exists
      let clampedOffset = deltaX;
      if (clampedOffset > 0 && !leftAction) clampedOffset = 0;
      if (clampedOffset < 0 && !rightAction) clampedOffset = 0;

      // Apply resistance at the edges
      const sign = clampedOffset > 0 ? 1 : -1;
      const abs = Math.abs(clampedOffset);
      const dampened = abs > maxSwipe ? maxSwipe + (abs - maxSwipe) * 0.2 : abs;
      setOffsetX(sign * dampened);
    },
    [disabled, leftAction, rightAction, maxSwipe]
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current) return;

    const absOffset = Math.abs(offsetX);
    const duration = Date.now() - touchRef.current.startTime;
    const velocity = absOffset / Math.max(1, duration);

    // Check if swipe exceeded threshold or had sufficient velocity
    const triggered = absOffset >= threshold || (absOffset > threshold * 0.5 && velocity > 0.5);

    if (triggered && offsetX > 0 && leftAction) {
      leftAction.onAction();
    } else if (triggered && offsetX < 0 && rightAction) {
      rightAction.onAction();
    }

    // Animate back to center
    setIsResetting(true);
    setOffsetX(0);
    setIsSwiping(false);
    touchRef.current = null;
  }, [offsetX, threshold, leftAction, rightAction]);

  // Clear resetting state after transition ends
  useEffect(() => {
    if (!isResetting) return;
    const timer = setTimeout(() => setIsResetting(false), 300);
    return () => clearTimeout(timer);
  }, [isResetting]);

  // Calculate action indicator opacity based on swipe progress
  const leftProgress = Math.min(1, Math.max(0, offsetX / threshold));
  const rightProgress = Math.min(1, Math.max(0, -offsetX / threshold));

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden rounded-sf-lg", className)}
    >
      {/* Left action indicator (revealed on right swipe) */}
      {leftAction && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start pl-4 rounded-l-sf-lg",
            leftAction.color
          )}
          style={{
            width: Math.max(0, offsetX),
            opacity: leftProgress,
          }}
          aria-hidden="true"
        >
          <div
            className={cn(
              "flex items-center gap-2 text-white text-sm font-medium transition-transform",
              leftProgress >= 1 ? "scale-110" : "scale-100"
            )}
          >
            {leftAction.icon}
            {leftProgress >= 0.6 && (
              <span className="whitespace-nowrap">{leftAction.label}</span>
            )}
          </div>
        </div>
      )}

      {/* Right action indicator (revealed on left swipe) */}
      {rightAction && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end pr-4 rounded-r-sf-lg",
            rightAction.color
          )}
          style={{
            width: Math.max(0, -offsetX),
            opacity: rightProgress,
          }}
          aria-hidden="true"
        >
          <div
            className={cn(
              "flex items-center gap-2 text-white text-sm font-medium transition-transform",
              rightProgress >= 1 ? "scale-110" : "scale-100"
            )}
          >
            {rightProgress >= 0.6 && (
              <span className="whitespace-nowrap">{rightAction.label}</span>
            )}
            {rightAction.icon}
          </div>
        </div>
      )}

      {/* Card content. Keyboard alternative to swipe (WCAG 2.5.1 Pointer Gestures):
          Alt+ArrowRight fires leftAction, Alt+ArrowLeft fires rightAction. Arrow
          keys alone stay free for focus traversal. */}
      <div
        className={cn(
          "relative bg-sf-bg-secondary touch-pan-y",
          isResetting && "transition-transform duration-300 ease-out"
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.altKey && e.key === "ArrowRight" && leftAction) {
            e.preventDefault();
            leftAction.onAction();
          } else if (e.altKey && e.key === "ArrowLeft" && rightAction) {
            e.preventDefault();
            rightAction.onAction();
          }
        }}
        tabIndex={disabled || (!leftAction && !rightAction) ? -1 : 0}
        role={leftAction || rightAction ? "button" : undefined}
        aria-label={
          leftAction && rightAction
            ? `Swipe card. Alt+Right: ${leftAction.label}. Alt+Left: ${rightAction.label}.`
            : leftAction
              ? `Swipe card. Alt+Right: ${leftAction.label}.`
              : rightAction
                ? `Swipe card. Alt+Left: ${rightAction.label}.`
                : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
