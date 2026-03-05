"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Custom hook that syncs filter values with URL query params.
 * Text input updates are debounced (300ms) to avoid excessive navigation.
 * Uses useTransition for smooth UX during URL updates.
 *
 * @param defaults - Default values for each filter key
 * @returns [params, setParam, resetParams]
 */
export function useFilterParams<T extends Record<string, string>>(
  defaults: T
): [T, (key: keyof T, value: string) => void, () => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const buildInitialParams = (): T => {
    const result = { ...defaults } as Record<string, string>;
    for (const key of Object.keys(defaults)) {
      const urlValue = searchParams.get(key);
      if (urlValue !== null) {
        result[key] = urlValue;
      }
    }
    return result as T;
  };

  const [localParams, setLocalParams] = useState<T>(buildInitialParams);

  // Track the latest pending state to avoid stale closures in debounce
  const pendingParams = useRef<T>(localParams);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when URL changes externally (e.g. browser back/forward)
  useEffect(() => {
    const synced = { ...defaults } as Record<string, string>;
    for (const key of Object.keys(defaults)) {
      const urlValue = searchParams.get(key);
      if (urlValue !== null) {
        synced[key] = urlValue;
      }
    }
    const next = synced as T;
    pendingParams.current = next;
    setLocalParams(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const buildQueryString = useCallback(
    (params: T): string => {
      const sp = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        const isDefault = value === (defaults as Record<string, string>)[key];
        if (value && !isDefault) {
          sp.set(key, value);
        }
      }
      const qs = sp.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [defaults, pathname]
  );

  const setParam = useCallback(
    (key: keyof T, value: string) => {
      const newParams = { ...pendingParams.current, [key as string]: value } as T;
      pendingParams.current = newParams;
      setLocalParams(newParams);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        startTransition(() => {
          router.push(buildQueryString(pendingParams.current), { scroll: false });
        });
      }, 300);
    },
    [router, startTransition, buildQueryString]
  );

  const resetParams = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const reset = { ...defaults };
    pendingParams.current = reset;
    setLocalParams(reset);

    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  }, [defaults, pathname, router, startTransition]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return [localParams, setParam, resetParams];
}
