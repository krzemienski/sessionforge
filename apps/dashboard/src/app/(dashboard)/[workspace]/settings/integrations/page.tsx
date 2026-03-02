"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link2, Link2Off, CheckCircle2, AlertCircle } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export default function IntegrationsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);

  const integration = useQuery({
    queryKey: ["devto-integration", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/devto?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load integration status");
      return res.json();
    },
  });

  const connect = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch("/api/integrations/devto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, apiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      return data;
    },
    onSuccess: () => {
      setApiKey("");
      setConnectError(null);
      qc.invalidateQueries({ queryKey: ["devto-integration", workspace] });
    },
    onError: (err: Error) => {
      setConnectError(err.message);
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/devto?workspace=${workspace}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to disconnect");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devto-integration", workspace] });
    },
  });

  const isConnected = integration.data?.connected === true;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Integrations</h1>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-sf bg-sf-bg-tertiary border border-sf-border flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-sf-text-primary">D</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-sf-text-primary">Dev.to</h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-xs text-sf-success bg-sf-success/10 border border-sf-success/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={11} />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-sf-text-muted bg-sf-bg-tertiary border border-sf-border px-2 py-0.5 rounded-full">
                  Not connected
                </span>
              )}
            </div>

            <p className="text-sm text-sf-text-secondary mb-4">
              Publish blog posts directly to your Dev.to account with one click.
            </p>

            {integration.isLoading && (
              <div className="animate-pulse h-8 bg-sf-bg-tertiary rounded w-1/3" />
            )}

            {!integration.isLoading && isConnected && (
              <div className="space-y-3">
                <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-4 py-3 text-sm space-y-1">
                  <p className="text-sf-text-primary">
                    <span className="text-sf-text-muted">Account: </span>
                    <span className="font-medium font-code">@{integration.data.username}</span>
                  </p>
                  {integration.data.connectedAt && (
                    <p className="text-xs text-sf-text-muted">
                      Connected {timeAgo(integration.data.connectedAt)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-sf-text-secondary">Update API Key</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setConnectError(null); }}
                      placeholder="Enter new Dev.to API key"
                      className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
                    />
                    <button
                      onClick={() => connect.mutate(apiKey)}
                      disabled={connect.isPending || !apiKey.trim()}
                      className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                    >
                      <Link2 size={14} />
                      {connect.isPending ? "Updating..." : "Update"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                  className="flex items-center gap-2 text-sf-danger border border-sf-danger/30 bg-sf-danger/5 hover:bg-sf-danger/10 px-4 py-2 rounded-sf text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Link2Off size={14} />
                  {disconnect.isPending ? "Disconnecting..." : "Disconnect Dev.to"}
                </button>

                {disconnect.isError && (
                  <p className="text-sm text-sf-danger flex items-center gap-1">
                    <AlertCircle size={13} />
                    {(disconnect.error as Error).message}
                  </p>
                )}
              </div>
            )}

            {!integration.isLoading && !isConnected && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                    Dev.to API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setConnectError(null); }}
                    placeholder="Paste your Dev.to API key"
                    className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
                  />
                  <p className="text-xs text-sf-text-muted mt-1">
                    Generate an API key at{" "}
                    <a
                      href="https://dev.to/settings/extensions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sf-accent hover:underline"
                    >
                      dev.to/settings/extensions
                    </a>
                  </p>
                </div>

                <button
                  onClick={() => connect.mutate(apiKey)}
                  disabled={connect.isPending || !apiKey.trim()}
                  className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                >
                  <Link2 size={14} />
                  {connect.isPending ? "Connecting..." : "Connect Dev.to"}
                </button>
              </div>
            )}

            {connectError && (
              <p className="text-sm text-sf-danger flex items-center gap-1 mt-2">
                <AlertCircle size={13} />
                {connectError}
              </p>
            )}

            {connect.isSuccess && (
              <p className="text-sm text-sf-success mt-2">
                Dev.to connected as @{integration.data?.username}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
