"use client";

import { useRouter } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";

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

  return (
    <div className="flex min-h-screen bg-sf-bg-primary">
      <AppSidebar workspace={workspace} userName={userName} />
      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      <MobileBottomNav workspace={workspace} />
    </div>
  );
}
