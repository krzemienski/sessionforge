"use client";

import { createContext, useContext } from "react";

export type ThemeMode = "dark";

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "dark";
  setTheme: (theme: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
