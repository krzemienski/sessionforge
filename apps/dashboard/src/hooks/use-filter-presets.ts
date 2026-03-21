"use client";

import { useCallback, useEffect, useState } from "react";
import type { FilterState } from "@/components/portfolio/filter-panel";

const MAX_PRESETS = 10;

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

function getStorageKey(workspaceSlug: string): string {
  return `sf-filter-presets-${workspaceSlug}`;
}

function readFromStorage(key: string): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FilterPreset[];
  } catch {
    return [];
  }
}

function writeToStorage(key: string, presets: FilterPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(presets));
  } catch {
    // Storage may be unavailable (private browsing quota exceeded, etc.)
  }
}

export function useFilterPresets(workspaceSlug: string) {
  const storageKey = getStorageKey(workspaceSlug);

  const [presets, setPresets] = useState<FilterPreset[]>(() =>
    readFromStorage(storageKey)
  );

  // Re-sync from localStorage when the workspace changes
  useEffect(() => {
    setPresets(readFromStorage(storageKey));
  }, [storageKey]);

  const savePreset = useCallback(
    (name: string, filters: FilterState): FilterPreset | null => {
      if (presets.length >= MAX_PRESETS) return null;

      const newPreset: FilterPreset = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        filters,
        createdAt: new Date().toISOString(),
      };

      const updated = [...presets, newPreset];
      writeToStorage(storageKey, updated);
      setPresets(updated);
      return newPreset;
    },
    [presets, storageKey]
  );

  const deletePreset = useCallback(
    (id: string): void => {
      const updated = presets.filter((p) => p.id !== id);
      writeToStorage(storageKey, updated);
      setPresets(updated);
    },
    [presets, storageKey]
  );

  const loadPreset = useCallback(
    (id: string): FilterPreset | null => {
      return presets.find((p) => p.id === id) ?? null;
    },
    [presets]
  );

  const listPresets = useCallback((): FilterPreset[] => {
    return presets;
  }, [presets]);

  const isAtLimit = presets.length >= MAX_PRESETS;

  return {
    presets,
    savePreset,
    deletePreset,
    loadPreset,
    listPresets,
    isAtLimit,
  };
}
