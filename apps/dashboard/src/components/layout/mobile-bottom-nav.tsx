"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ScrollText,
  FileText,
  Zap,
  MoreHorizontal,
  Lightbulb,
  BarChart3,
  Activity,
  Settings,
  X,
  PenLine,
} from "lucide-react";

const tabs = [
  { label: "Home", icon: LayoutDashboard, href: "" },
  { label: "Sessions", icon: ScrollText, href: "/sessions" },
  { label: "Content", icon: FileText, href: "/content" },
  { label: "Automation", icon: Zap, href: "/automation" },
];

const moreItems = [
  { label: "Insights", icon: Lightbulb, href: "/insights" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Pipeline", icon: Activity, href: "/observability" },
  { label: "Writing Coach", icon: PenLine, href: "/writing-coach" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function MobileBottomNav({ workspace }: { workspace: string }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  function isActive(href: string) {
    const full = `/${workspace}${href}`;
    if (href === "") return pathname === `/${workspace}`;
    return pathname.startsWith(full);
  }

  const isMoreActive = moreItems.some((item) => isActive(item.href));

  return (
    <>
      {/* More sheet overlay */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute left-0 right-0 bg-sf-bg-secondary border-t border-sf-border rounded-t-2xl p-4 space-y-1"
            style={{
              bottom: "calc(4rem + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-sf-text-primary">More</span>
              <button onClick={() => setShowMore(false)} aria-label="Close" className="p-1 text-sf-text-muted">
                <X size={18} />
              </button>
            </div>
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={`/${workspace}${item.href}`}
                onClick={() => setShowMore(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-sf text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-sf-accent/10 text-sf-accent"
                    : "text-sf-text-secondary hover:bg-sf-bg-tertiary"
                )}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-sf-bg-secondary border-t border-sf-border flex items-center justify-around z-50"
        style={{
          height: "calc(4rem + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={`/${workspace}${tab.href}`}
            aria-label={tab.label}
            aria-current={isActive(tab.href) ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] transition-all active:scale-95",
              isActive(tab.href)
                ? "text-sf-accent bg-sf-accent/10 border-t-2 border-sf-accent"
                : "text-sf-text-muted hover:text-sf-text hover:bg-sf-bg-tertiary/50 active:bg-sf-bg-tertiary"
            )}
          >
            <tab.icon size={22} strokeWidth={isActive(tab.href) ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setShowMore(!showMore)}
          aria-label="More"
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] transition-all active:scale-95",
            isMoreActive || showMore
              ? "text-sf-accent bg-sf-accent/10 border-t-2 border-sf-accent"
              : "text-sf-text-muted hover:text-sf-text hover:bg-sf-bg-tertiary/50 active:bg-sf-bg-tertiary"
          )}
        >
          <MoreHorizontal size={22} strokeWidth={isMoreActive || showMore ? 2.5 : 2} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </>
  );
}
