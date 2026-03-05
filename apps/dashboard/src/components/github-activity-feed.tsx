"use client";

import { useGitHubActivity, useExcludeFromContent } from "@/hooks/use-github";
import { timeAgo } from "@/lib/utils";
import { GitCommit, GitPullRequest, ExternalLink, Loader2, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface GitHubActivityFeedProps {
  workspace: string;
  limit?: number;
}

export function GitHubActivityFeed({ workspace, limit = 20 }: GitHubActivityFeedProps) {
  const { data, isLoading, error } = useGitHubActivity(workspace, { limit });
  const activities = data?.activity ?? [];
  const excludeMutation = useExcludeFromContent();
  const [excludingIds, setExcludingIds] = useState<Set<string>>(new Set());

  const handleExclude = async (activity: any) => {
    const activityId = `${activity.type}-${activity.id}`;
    setExcludingIds(new Set(excludingIds).add(activityId));

    try {
      await excludeMutation.mutateAsync({
        workspace,
        repositoryId: activity.repositoryId,
        commitSha: activity.type === "commit" ? activity.sha : undefined,
      });
    } catch (error) {
      console.error("Failed to exclude item:", error);
    } finally {
      setExcludingIds((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  };

  if (error) {
    return (
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
        <p className="text-sm text-sf-text-muted">Failed to load GitHub activity</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-sf-text-muted" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8 text-center">
        <GitCommit size={40} className="mx-auto text-sf-text-muted mb-3" />
        <h3 className="font-semibold text-sf-text-primary mb-1">No GitHub activity yet</h3>
        <p className="text-sm text-sf-text-secondary">
          Connect a repository and sync to see commits and pull requests here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity: any) => {
        const isCommit = activity.type === "commit";
        const isPR = activity.type === "pull_request";
        const activityId = `${activity.type}-${activity.id}`;
        const isExcluding = excludingIds.has(activityId);

        return (
          <div
            key={activityId}
            className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "mt-0.5 p-1.5 rounded-sf",
                isCommit ? "bg-sf-info/10 text-sf-info" : "bg-sf-success/10 text-sf-success"
              )}>
                {isCommit ? <GitCommit size={16} /> : <GitPullRequest size={16} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <a
                      href={activity.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sf-text-primary font-medium hover:text-sf-accent transition-colors inline-flex items-center gap-1.5 group"
                    >
                      <span className="line-clamp-2">
                        {isCommit ? activity.message : activity.title}
                      </span>
                      <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-sf-text-muted whitespace-nowrap">
                      {timeAgo(activity.date)}
                    </span>
                    <button
                      onClick={() => handleExclude(activity)}
                      disabled={isExcluding}
                      className="p-1.5 rounded-sf hover:bg-sf-bg-tertiary text-sf-text-muted hover:text-sf-text-secondary transition-colors disabled:opacity-50"
                      title="Exclude from content generation"
                    >
                      {isExcluding ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <EyeOff size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-sf-text-secondary">
                  <span className="font-medium">{activity.authorName || "Unknown"}</span>
                  <span className="text-sf-text-muted">•</span>
                  <a
                    href={activity.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-sf-accent transition-colors"
                  >
                    {activity.repoName}
                  </a>
                  {isCommit && (
                    <>
                      <span className="text-sf-text-muted">•</span>
                      <code className="px-1.5 py-0.5 bg-sf-bg-tertiary rounded text-xs font-mono">
                        {activity.sha.slice(0, 7)}
                      </code>
                    </>
                  )}
                  {isPR && (
                    <>
                      <span className="text-sf-text-muted">•</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-sf-full text-xs font-medium",
                        activity.state === "open"
                          ? "bg-sf-success/10 text-sf-success"
                          : activity.mergedAt
                          ? "bg-sf-accent-bg text-sf-accent"
                          : "bg-sf-text-muted/10 text-sf-text-muted"
                      )}>
                        {activity.state === "open" ? "Open" : activity.mergedAt ? "Merged" : "Closed"}
                      </span>
                      <span className="text-sf-text-muted">•</span>
                      <span>#{activity.number}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
