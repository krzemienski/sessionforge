"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ChecklistItemStatus = {
  id: string;
  label: string;
  href: string;
  completed: boolean;
};

export function OnboardingChecklist({ workspace }: { workspace: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const isDismissed = localStorage.getItem("sf_checklist_dismissed") === "true";
    setDismissed(isDismissed);
  }, []);

  // Fetch sessions count
  const sessions = useQuery({
    queryKey: ["sessions", workspace, "count"],
    queryFn: async () => {
      const res = await fetch(`/api/sessions?workspace=${workspace}&limit=1`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      return data.total ?? 0;
    },
    enabled: !!workspace && !dismissed,
  });

  // Fetch insights count
  const insights = useQuery({
    queryKey: ["insights", workspace, "count"],
    queryFn: async () => {
      const res = await fetch(`/api/insights?workspace=${workspace}&limit=1`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      const data = await res.json();
      return data.total ?? 0;
    },
    enabled: !!workspace && !dismissed,
  });

  // Fetch content count
  const content = useQuery({
    queryKey: ["content", workspace, "count"],
    queryFn: async () => {
      const res = await fetch(`/api/content?workspace=${workspace}&limit=1`);
      if (!res.ok) throw new Error("Failed to fetch content");
      const data = await res.json();
      return data.total ?? 0;
    },
    enabled: !!workspace && !dismissed,
  });

  // Check Twitter integration
  const twitterIntegration = useQuery({
    queryKey: ["integrations", workspace, "twitter"],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/twitter?workspace=${workspace}`);
      if (!res.ok) return { connected: false };
      const data = await res.json();
      return data;
    },
    enabled: !!workspace && !dismissed,
  });

  // Check Medium integration
  const mediumIntegration = useQuery({
    queryKey: ["integrations", workspace, "medium"],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/medium?workspace=${workspace}`);
      if (!res.ok) return { connected: false };
      const data = await res.json();
      return data;
    },
    enabled: !!workspace && !dismissed,
  });

  // Check Ghost integration
  const ghostIntegration = useQuery({
    queryKey: ["integrations", workspace, "ghost"],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/ghost?workspace=${workspace}`);
      if (!res.ok) return { connected: false };
      const data = await res.json();
      return data;
    },
    enabled: !!workspace && !dismissed,
  });

  // Check Dev.to integration
  const devtoIntegration = useQuery({
    queryKey: ["integrations", workspace, "devto"],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/devto?workspace=${workspace}`);
      if (!res.ok) return { connected: false };
      const data = await res.json();
      return data;
    },
    enabled: !!workspace && !dismissed,
  });

  const handleDismiss = () => {
    localStorage.setItem("sf_checklist_dismissed", "true");
    setDismissed(true);
  };

  // Don't render if dismissed
  if (dismissed) return null;

  // Don't render while loading
  const isLoading =
    sessions.isLoading ||
    insights.isLoading ||
    content.isLoading ||
    twitterIntegration.isLoading ||
    mediumIntegration.isLoading ||
    ghostIntegration.isLoading ||
    devtoIntegration.isLoading;

  if (isLoading) return null;

  // Check if any integration is connected
  const hasIntegration =
    twitterIntegration.data?.connected === true ||
    mediumIntegration.data?.connected === true ||
    ghostIntegration.data?.connected === true ||
    devtoIntegration.data?.connected === true;

  // Build checklist items
  const items: ChecklistItemStatus[] = [
    {
      id: "workspace",
      label: "Create workspace",
      href: `/${workspace}`,
      completed: true, // Always checked when in dashboard
    },
    {
      id: "sessions",
      label: "Scan sessions",
      href: `/${workspace}/sessions`,
      completed: (sessions.data ?? 0) > 0,
    },
    {
      id: "insights",
      label: "Extract insights",
      href: `/${workspace}/insights`,
      completed: (insights.data ?? 0) > 0,
    },
    {
      id: "content",
      label: "Generate content",
      href: `/${workspace}/content`,
      completed: (content.data ?? 0) > 0,
    },
    {
      id: "integration",
      label: "Connect publishing platform",
      href: `/${workspace}/settings`,
      completed: hasIntegration,
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const allComplete = completedCount === totalCount;

  // Don't show if all complete
  if (allComplete) return null;

  return (
    <div className="border border-sf-border rounded-sf-lg bg-sf-bg-secondary p-3 space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm font-display font-medium text-sf-text-primary hover:text-sf-accent transition-colors"
        >
          <CheckSquare size={16} className="text-sf-accent" />
          <span>Setup Checklist</span>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={handleDismiss}
          className="text-sf-text-muted hover:text-sf-text-primary transition-colors"
          aria-label="Dismiss checklist"
        >
          <X size={16} />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="text-xs text-sf-text-muted font-display">
            {completedCount} of {totalCount} complete
          </div>

          <div className="space-y-1.5">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 text-sm font-display px-2 py-1.5 rounded-sf transition-colors",
                  item.completed
                    ? "text-sf-text-muted line-through"
                    : "text-sf-text-primary hover:bg-sf-bg-hover"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 border rounded flex items-center justify-center flex-shrink-0",
                    item.completed
                      ? "bg-sf-accent border-sf-accent"
                      : "border-sf-border"
                  )}
                >
                  {item.completed && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
