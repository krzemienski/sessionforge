"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ScrollText,
  Lightbulb,
  FileText,
  Settings,
} from "lucide-react";

const tabs = [
  { label: "Home", icon: LayoutDashboard, href: "" },
  { label: "Sessions", icon: ScrollText, href: "/sessions" },
  { label: "Insights", icon: Lightbulb, href: "/insights" },
  { label: "Content", icon: FileText, href: "/content" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function MobileBottomNav({ workspace }: { workspace: string }) {
  const pathname = usePathname();

  function isActive(href: string) {
    const full = `/${workspace}${href}`;
    if (href === "") return pathname === `/${workspace}`;
    return pathname.startsWith(full);
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-sf-bg-secondary border-t border-sf-border flex items-center justify-around z-50">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={`/${workspace}${tab.href}`}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors",
            isActive(tab.href)
              ? "text-sf-accent border-t-2 border-sf-accent"
              : "text-sf-text-muted"
          )}
        >
          <tab.icon size={20} />
          <span className="text-[10px]">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
