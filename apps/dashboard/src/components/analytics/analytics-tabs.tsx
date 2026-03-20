"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { BarChart2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export function AnalyticsTabs() {
  const { workspace } = useParams<{ workspace: string }>();
  const pathname = usePathname();

  const tabs: Tab[] = [
    {
      label: "Social Analytics",
      href: `/${workspace}/analytics`,
      icon: <BarChart2 size={16} />,
    },
    {
      label: "Attribution & ROI",
      href: `/${workspace}/analytics/roi`,
      icon: <TrendingUp size={16} />,
    },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-sf-border mb-6">
      {tabs.map((tab) => {
        const isActive =
          tab.href === `/${workspace}/analytics`
            ? pathname === `/${workspace}/analytics`
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-sf-accent text-sf-text-primary"
                : "border-transparent text-sf-text-secondary hover:text-sf-text-primary hover:border-sf-border-focus"
            )}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
