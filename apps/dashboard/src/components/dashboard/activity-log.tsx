"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import type { ActivityEvent } from "@/app/api/activity/route";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Bot,
  Workflow,
} from "lucide-react";

const eventConfig: Record<
  ActivityEvent["type"],
  { icon: typeof CheckCircle2; color: string; bg: string }
> = {
  pipeline_complete: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  pipeline_failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  pipeline_running: {
    icon: Loader2,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  agent_complete: {
    icon: Bot,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  agent_failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  agent_running: {
    icon: Loader2,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
};

function ActivityItem({
  event,
  workspace,
}: {
  event: ActivityEvent;
  workspace: string;
}) {
  const config = eventConfig[event.type] ?? eventConfig.pipeline_complete;
  const Icon = config.icon;
  const isRunning = event.type.endsWith("_running");

  const href = event.type.startsWith("pipeline_")
    ? `/${workspace}/automation`
    : event.metadata?.postId
      ? `/${workspace}/content/${event.metadata.postId}`
      : `/${workspace}/insights`;

  return (
    <Link
      href={href}
      className="flex items-start gap-3 px-3 py-3 rounded-sf hover:bg-sf-bg-tertiary transition-colors group"
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bg}`}
      >
        <Icon
          size={16}
          className={`${config.color} ${isRunning ? "animate-spin" : ""}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-sf-text-primary group-hover:text-sf-accent transition-colors">
          {event.title}
        </p>
        {event.description && (
          <p className="text-xs text-sf-text-muted mt-0.5 truncate">
            {event.description}
          </p>
        )}
        <p className="text-xs text-sf-text-muted mt-1">
          {timeAgo(event.timestamp)}
        </p>
      </div>
    </Link>
  );
}

export function ActivityLog({
  events,
  workspace,
  isLoading,
}: {
  events: ActivityEvent[];
  workspace: string;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sf-text-primary uppercase tracking-wide">
            Activity
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-sf-text-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-sf-text-primary uppercase tracking-wide">
          Activity
        </h2>
        {events.length > 0 && (
          <Link
            href={`/${workspace}/automation`}
            className="text-xs text-sf-accent hover:text-sf-accent-dim transition-colors"
          >
            View all →
          </Link>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8">
          <Workflow size={32} className="mx-auto text-sf-text-muted mb-3" />
          <p className="text-sm text-sf-text-secondary mb-1">
            No recent activity
          </p>
          <p className="text-xs text-sf-text-muted">
            Run a scan or trigger an automation to see events here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-sf-border">
          {events.map((event) => (
            <ActivityItem key={event.id} event={event} workspace={workspace} />
          ))}
        </div>
      )}
    </div>
  );
}
