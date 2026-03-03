"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";
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
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useKeyboardShortcut(SHORTCUTS.Navigation[0], () =>
    router.push(`/${workspace}`)
  );
  useKeyboardShortcut(SHORTCUTS.Navigation[1], () =>
    router.push(`/${workspace}/sessions`)
  );
  useKeyboardShortcut(SHORTCUTS.Navigation[2], () =>
    router.push(`/${workspace}/insights`)
  );
  useKeyboardShortcut(SHORTCUTS.Navigation[3], () =>
    router.push(`/${workspace}/content`)
  );
  useKeyboardShortcut(SHORTCUTS.Navigation[4], () =>
    router.push(`/${workspace}/automation`)
  );

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
