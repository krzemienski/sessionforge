"use client";

import { CheckCircle, XCircle, Clock } from "lucide-react";

interface ActivityItem {
  id: string;
  status: "published" | "failed";
  updatedAt: string;
  error?: string | null;
  post: {
    id: string;
    title?: string | null;
  };
}

interface RecentActivityProps {
  items: ActivityItem[];
}

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-sf-text-primary mb-3">Recent Activity</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-3"
          >
            {item.status === "published" ? (
              <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle size={16} className="text-sf-error mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sf-text-primary truncate">
                {item.post?.title || "Untitled Post"}
              </p>
              <p className="text-xs text-sf-text-secondary mt-0.5">
                {item.status === "published" ? "Published successfully" : `Failed: ${item.error || "Unknown error"}`}
              </p>
              {item.updatedAt && (
                <p className="text-xs text-sf-text-muted mt-0.5 flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(item.updatedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                item.status === "published"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-sf-error/10 text-sf-error"
              }`}
            >
              {item.status === "published" ? "Published" : "Failed"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
