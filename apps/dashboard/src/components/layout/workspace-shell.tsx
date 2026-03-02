"use client";

import { useState, useEffect } from "react";
import { AppSidebar } from "./app-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { GlobalSearchModal } from "@/components/search/global-search-modal";

export function WorkspaceShell({
  workspace,
  userName,
  children,
}: {
  workspace: string;
  userName: string;
  children: React.ReactNode;
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-sf-bg-primary">
      <AppSidebar
        workspace={workspace}
        userName={userName}
        onOpenSearch={() => setIsSearchOpen(true)}
      />
      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      <MobileBottomNav workspace={workspace} />
      {isSearchOpen && (
        <GlobalSearchModal
          workspace={workspace}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </div>
  );
}
