"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppSidebar } from "./app-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";
import { GlobalSearchModal } from "@/components/search/global-search-modal";

function SystemHealthIndicator() {
  const health = useQuery({
    queryKey: ["healthcheck"],
    queryFn: async () => {
      const res = await fetch("/api/healthcheck");
      return res.json() as Promise<{ status: string; db: boolean; redis: boolean }>;
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  const status = health.data?.status;
  const color =
    status === "ok" ? "bg-emerald-400" :
    status === "degraded" ? "bg-yellow-400" :
    health.isError ? "bg-red-400" : "bg-sf-text-muted";

  const label =
    status === "ok" ? "All systems operational" :
    status === "degraded" ? `Degraded (DB: ${health.data?.db ? "ok" : "down"}, Redis: ${health.data?.redis ? "ok" : "down"})` :
    health.isError ? "Health check failed" : "Checking...";

  return (
    <div className="flex items-center gap-1.5 px-3 py-1" title={label}>
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-[10px] text-sf-text-muted">{status === "ok" ? "Healthy" : status ?? "..."}</span>
    </div>
  );
}

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
    <div className="flex h-screen bg-sf-bg-primary overflow-hidden">
      <AppSidebar
        workspace={workspace}
        userName={userName}
        onOpenSearch={() => setIsSearchOpen(true)}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex justify-end mb-2">
          <SystemHealthIndicator />
        </div>
        {children}
      </main>
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
