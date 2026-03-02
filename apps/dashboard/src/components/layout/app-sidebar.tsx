"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ScrollText,
  Lightbulb,
  FileText,
  Zap,
  Settings,
  Palette,
  KeyRound,
  Brain,
  LogOut,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const mainNav = [
  { label: "Dashboard", icon: LayoutDashboard, href: "" },
  { label: "Sessions", icon: ScrollText, href: "/sessions" },
  { label: "Insights", icon: Lightbulb, href: "/insights" },
  { label: "Content", icon: FileText, href: "/content" },
  { label: "Automation", icon: Zap, href: "/automation" },
];

const settingsNav = [
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "Style", icon: Palette, href: "/settings/style" },
  { label: "Writing Skills", icon: Brain, href: "/settings/skills" },
  { label: "API Keys", icon: KeyRound, href: "/settings/api-keys" },
];

export function AppSidebar({
  workspace,
  userName,
}: {
  workspace: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    const full = `/${workspace}${href}`;
    if (href === "") return pathname === `/${workspace}`;
    return pathname.startsWith(full);
  }

  return (
    <aside className="hidden md:flex flex-col w-[260px] border-r border-sf-border bg-sf-bg-secondary h-screen sticky top-0">
      <div className="p-4 border-b border-sf-border">
        <Link href={`/${workspace}`} className="text-sf-accent font-bold tracking-tight font-display text-lg">
          SessionForge
        </Link>
        <p className="text-sf-text-muted text-xs mt-1 font-display truncate">{workspace}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {mainNav.map((item) => (
          <Link
            key={item.href}
            href={`/${workspace}${item.href}`}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-sf text-sm font-display transition-colors",
              isActive(item.href)
                ? "bg-sf-accent-bg text-sf-accent"
                : "text-sf-text-secondary hover:bg-sf-bg-hover hover:text-sf-text-primary"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}

        <div className="h-px bg-sf-border my-3" />

        {settingsNav.map((item) => (
          <Link
            key={item.href}
            href={`/${workspace}${item.href}`}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-sf text-sm font-display transition-colors",
              isActive(item.href)
                ? "bg-sf-accent-bg text-sf-accent"
                : "text-sf-text-secondary hover:bg-sf-bg-hover hover:text-sf-text-primary"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-sf-border">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sf-text-primary text-sm truncate">{userName}</span>
          <button
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
            className="text-sf-text-muted hover:text-sf-danger transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
