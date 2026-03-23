"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface PullToRefreshState {
  /** Current pull distance in pixels */
  pullDistance: number;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Whether the user is actively pulling */
  isPulling: boolean;
}

interface UsePullToRefreshOptions {
  /** Distance in pixels required to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance in pixels (default: 150) */
  maxPullDistance?: number;
  /** Disable the hook */
  disabled?: boolean;
}

export function usePullToRefresh(
  ref: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void>,
  options: UsePullToRefreshOptions = {}
): PullToRefreshState {
  const {
    threshold = 80,
    maxPullDistance = 150,
    disabled = false,
  } = options;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const touchStartRef = useRef<{ y: number } | null>(null);
  const isRefreshingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshingRef.current) return;
      const element = ref.current;
      if (!element) return;

      // Only activate when scrolled to the top
      if (element.scrollTop > 0) return;

      const touch = e.touches[0];
      if (!touch) return;

      touchStartRef.current = { y: touch.clientY };
    },
    [disabled, ref]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshingRef.current) return;
      const start = touchStartRef.current;
      if (!start) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaY = touch.clientY - start.y;

      // Only handle downward pull
      if (deltaY <= 0) {
        setPullDistance(0);
        setIsPulling(false);
        return;
      }

      // Apply resistance: diminishing returns as pull increases
      const resistedDistance = Math.min(
        deltaY * 0.5,
        maxPullDistance
      );

      setPullDistance(resistedDistance);
      setIsPulling(true);
    },
    [disabled, maxPullDistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshingRef.current) return;
    const start = touchStartRef.current;
    if (!start) return;

    touchStartRef.current = null;
    setIsPulling(false);

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      isRefreshingRef.current = true;

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        isRefreshingRef.current = false;
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    element.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    element.addEventListener("touchmove", handleTouchMove, {
      passive: true,
    });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  return { pullDistance, isRefreshing, isPulling };
}

export type { PullToRefreshState, UsePullToRefreshOptions };
