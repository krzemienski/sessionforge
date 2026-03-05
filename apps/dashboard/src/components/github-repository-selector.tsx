"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, GitBranch } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface GitHubRepositorySelectorProps {
  workspace: string;
}

interface AvailableRepo {
  id: number;
  name: string;
  description: string | null;
  url: string;
  defaultBranch: string;
  private: boolean;
  owner: string;
  updatedAt: string;
}

interface ConnectedRepo {
  id: string;
  githubRepoId: number;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface ReposResponse {
  connected: ConnectedRepo[];
  available?: AvailableRepo[];
}

export default function GitHubRepositorySelector({ workspace }: GitHubRepositorySelectorProps) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const repos = useQuery<ReposResponse>({
    queryKey: ["github-repos-selector", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/github/repos?workspace=${workspace}&refresh=true`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load repositories");
      }
      return res.json();
    },
  });

  const connect = useMutation({
    mutationFn: async ({ owner, repo }: { owner: string; repo: string }) => {
      const res = await fetch("/api/integrations/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, owner, repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect repository");
      return data;
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["github-repos-selector", workspace] });
      qc.invalidateQueries({ queryKey: ["github-repos", workspace] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const disconnect = useMutation({
    mutationFn: async (repoId: string) => {
      const res = await fetch(`/api/integrations/github/repos?workspace=${workspace}&repoId=${repoId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to disconnect repository");
      }
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["github-repos-selector", workspace] });
      qc.invalidateQueries({ queryKey: ["github-repos", workspace] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const refresh = () => {
    setError(null);
    qc.invalidateQueries({ queryKey: ["github-repos-selector", workspace] });
  };

  const isRepoConnected = (githubRepoId: number): ConnectedRepo | undefined => {
    return repos.data?.connected.find((r) => r.githubRepoId === githubRepoId);
  };

  const handleToggle = (repo: AvailableRepo) => {
    const connected = isRepoConnected(repo.id);
    if (connected) {
      disconnect.mutate(connected.id);
    } else {
      const [owner, repoName] = repo.name.split("/");
      connect.mutate({ owner, repo: repoName });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-sf-text-secondary">
          Select Repositories to Connect
        </p>
        <button
          onClick={refresh}
          disabled={repos.isLoading}
          className="flex items-center gap-1.5 text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={repos.isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-sf-danger/10 border border-sf-danger/20 rounded-sf px-3 py-2 text-sm text-sf-danger flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {repos.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-16 bg-sf-bg-tertiary rounded-sf" />
          ))}
        </div>
      )}

      {!repos.isLoading && repos.data?.available && repos.data.available.length === 0 && (
        <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-4 py-8 text-center">
          <p className="text-sm text-sf-text-muted">
            No repositories found in your GitHub account.
          </p>
        </div>
      )}

      {!repos.isLoading && repos.data?.available && repos.data.available.length > 0 && (
        <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf divide-y divide-sf-border max-h-96 overflow-y-auto">
          {repos.data.available.map((repo) => {
            const connected = isRepoConnected(repo.id);
            const isProcessing = connect.isPending || disconnect.isPending;

            return (
              <label
                key={repo.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-sf-bg-secondary/50 transition-colors ${
                  isProcessing ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!connected}
                  onChange={() => handleToggle(repo)}
                  className="mt-1 w-4 h-4 rounded border-sf-border bg-sf-bg-primary checked:bg-sf-accent checked:border-sf-accent focus:ring-2 focus:ring-sf-accent/20 transition-colors"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-code text-sm font-medium text-sf-text-primary truncate">
                      {repo.name}
                    </span>
                    {repo.private && (
                      <span className="text-xs text-sf-text-muted bg-sf-bg-primary border border-sf-border px-1.5 py-0.5 rounded">
                        Private
                      </span>
                    )}
                    {connected && (
                      <span className="inline-flex items-center gap-1 text-xs text-sf-success">
                        <CheckCircle2 size={11} />
                        Connected
                      </span>
                    )}
                  </div>

                  {repo.description && (
                    <p className="text-xs text-sf-text-secondary mb-1 line-clamp-1">
                      {repo.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-sf-text-muted">
                    <span className="flex items-center gap-1">
                      <GitBranch size={11} />
                      {repo.defaultBranch}
                    </span>
                    <span>Updated {timeAgo(repo.updatedAt)}</span>
                  </div>

                  {connected?.lastSyncedAt && (
                    <p className="text-xs text-sf-text-muted mt-1">
                      Last synced {timeAgo(connected.lastSyncedAt)}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {!repos.isLoading && repos.isError && (
        <div className="bg-sf-danger/10 border border-sf-danger/20 rounded-sf px-4 py-8 text-center">
          <p className="text-sm text-sf-danger flex items-center justify-center gap-2">
            <AlertCircle size={14} />
            {(repos.error as Error).message}
          </p>
        </div>
      )}
    </div>
  );
}
