"use client";

import { useEffect, useCallback, useRef } from "react";

type SwipeDirection = "left" | "right" | "up" | "down";

interface SwipeEvent {
  direction: SwipeDirection;
  deltaX: number;
  deltaY: number;
  velocity: number;
}

interface UseSwipeGestureOptions {
  /** Minimum distance in pixels to trigger a swipe (default: 50) */
  threshold?: number;
  /** Maximum time in ms for a swipe gesture (default: 300) */
  maxDuration?: number;
  /** Minimum velocity in px/ms to trigger a swipe (default: 0.3) */
  minVelocity?: number;
  /** Which directions to detect (default: all) */
  directions?: SwipeDirection[];
  /** Disable the hook */
  disabled?: boolean;
}

export function useSwipeGesture(
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: SwipeEvent) => void,
  options: UseSwipeGestureOptions = {}
): void {
  const {
    threshold = 50,
    maxDuration = 300,
    minVelocity = 0.3,
    directions = ["left", "right", "up", "down"],
    disabled = false,
  } = options;

  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    [disabled]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;
      const start = touchStartRef.current;
      if (!start) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const duration = Date.now() - start.time;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      touchStartRef.current = null;

      if (duration > maxDuration) return;

      const isHorizontal = absDeltaX > absDeltaY;
      const distance = isHorizontal ? absDeltaX : absDeltaY;

      if (distance < threshold) return;

      const velocity = distance / duration;
      if (velocity < minVelocity) return;

      let direction: SwipeDirection;
      if (isHorizontal) {
        direction = deltaX > 0 ? "right" : "left";
      } else {
        direction = deltaY > 0 ? "down" : "up";
      }

      if (!directions.includes(direction)) return;

      handler({ direction, deltaX, deltaY, velocity });
    },
    [disabled, threshold, maxDuration, minVelocity, directions, handler]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    element.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, handleTouchStart, handleTouchEnd, disabled]);
}

export type { SwipeDirection, SwipeEvent, UseSwipeGestureOptions };
