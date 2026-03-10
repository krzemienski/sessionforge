"use client";

import { type ReactNode } from "react";
import { ThemeContext } from "@/hooks/use-theme";

/** Dark-mode-only ThemeProvider. No light/system theme support. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider
      value={{ theme: "dark", resolvedTheme: "dark", setTheme: () => {} }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
