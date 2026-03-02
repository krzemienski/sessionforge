"use client";

import { AppSidebar } from "./app-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";

export function WorkspaceShell({
  workspace,
  userName,
  children,
}: {
  workspace: string;
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-sf-bg-primary">
      <AppSidebar workspace={workspace} userName={userName} />
      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      <MobileBottomNav workspace={workspace} />
    </div>
  );
}
