"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Link2 } from "lucide-react";
import { IntegrationHealthPanel } from "./integration-health-panel";

interface IntegrationsTabProps {
  workspace: string;
}

type HealthStatus = "healthy" | "degraded" | "unhealthy" | "auth_expired" | "paused";

interface IntegrationHealthEntry {
  platform: string;
  status: HealthStatus;
  lastCheckedAt: string | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  connectedAt: string | null;
  enabled: boolean;
}

interface HealthResponse {
  integrations: IntegrationHealthEntry[];
}

const HEALTH_DOT_COLORS: Record<HealthStatus, string> = {
  healthy: "bg-sf-success",
  degraded: "bg-yellow-500",
  unhealthy: "bg-sf-error",
  auth_expired: "bg-sf-error",
  paused: "bg-sf-text-muted",
};

export function IntegrationsTab({ workspace }: IntegrationsTabProps) {
  const qc = useQueryClient();

  const integrations = useQuery({
    queryKey: ["integrations", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/integrations`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const health = useQuery<HealthResponse>({
    queryKey: ["integration-health", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/health?workspace=${encodeURIComponent(workspace)}`);
      if (!res.ok) throw new Error("Failed to fetch integration health");
      return res.json();
    },
    enabled: !!workspace,
    refetchInterval: 60_000,
  });

  const [hashnodeToken, setHashnodeToken] = useState("");
  const [hashnodePubId, setHashnodePubId] = useState("");
  const [hashnodeDomain, setHashnodeDomain] = useState("");

  useEffect(() => {
    if (integrations.data) {
      setHashnodeToken("");
      setHashnodePubId(integrations.data.hashnodePublicationId || "");
      setHashnodeDomain(integrations.data.hashnodeDefaultCanonicalDomain || "");
    }
  }, [integrations.data]);

  const saveHashnode = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        hashnodePublicationId: hashnodePubId,
        hashnodeDefaultCanonicalDomain: hashnodeDomain,
      };
      if (hashnodeToken) body.hashnodeToken = hashnodeToken;
      const res = await fetch(`/api/workspace/${workspace}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", workspace] }),
  });

  if (integrations.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  const hasExistingToken = !!integrations.data?.hashnodeApiToken;

  // Build a map of platform -> health status from the health endpoint
  const healthByPlatform = new Map<string, IntegrationHealthEntry>();
  for (const entry of health.data?.integrations ?? []) {
    healthByPlatform.set(entry.platform, entry);
  }

  const INTEGRATIONS = [
    {
      id: "hashnode",
      name: "Hashnode",
      description: "Publish blog posts directly to your Hashnode blog.",
      connected: hasExistingToken,
      configurable: true,
    },
    {
      id: "devto",
      name: "Dev.to",
      description: "Cross-post articles to the Dev.to community.",
      connected: healthByPlatform.has("devto"),
      configurable: false,
    },
    {
      id: "twitter",
      name: "Twitter / X",
      description: "Share thread content to Twitter/X.",
      connected: healthByPlatform.has("twitter"),
      configurable: false,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      description: "Publish professional content to LinkedIn.",
      connected: healthByPlatform.has("linkedin"),
      configurable: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Integration Health Panel */}
      <IntegrationHealthPanel workspace={workspace} />

      {/* Integration Cards */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={18} className="text-sf-accent" />
          <h2 className="text-base font-semibold font-display">Integrations</h2>
        </div>

        <div className="grid gap-4">
          {INTEGRATIONS.map((integration) => {
            const healthEntry = healthByPlatform.get(integration.id);
            const healthDotColor = healthEntry
              ? HEALTH_DOT_COLORS[healthEntry.status] ?? HEALTH_DOT_COLORS.healthy
              : null;

            return (
              <div key={integration.id} className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-sf-text-primary">{integration.name}</h3>
                  <div className="flex items-center gap-2">
                    {healthDotColor && (
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${healthDotColor}`}
                        title={`Health: ${healthEntry!.status}`}
                      />
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${integration.connected ? "bg-sf-success/10 text-sf-success" : "bg-sf-bg-tertiary text-sf-text-muted"}`}>
                      {integration.connected ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-sf-text-secondary mb-3">{integration.description}</p>

                {integration.id === "hashnode" && (
                  <div className="space-y-3 pt-3 border-t border-sf-border">
                    <div>
                      <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                        API Token {hasExistingToken && <span className="text-xs text-sf-text-muted">(masked: {integrations.data.hashnodeApiToken})</span>}
                      </label>
                      <input type="password" value={hashnodeToken} onChange={(e) => setHashnodeToken(e.target.value)} placeholder={hasExistingToken ? "Enter new token to update" : "Enter your Hashnode API token"} className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-sf-text-secondary mb-1">Publication ID</label>
                      <input value={hashnodePubId} onChange={(e) => setHashnodePubId(e.target.value)} placeholder="Your Hashnode publication ID" className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-sf-text-secondary mb-1">Default Canonical Domain</label>
                      <input value={hashnodeDomain} onChange={(e) => setHashnodeDomain(e.target.value)} placeholder="e.g. blog.example.com" className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
                    </div>
                    <button onClick={() => saveHashnode.mutate()} disabled={saveHashnode.isPending} className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50">
                      <Save size={16} />
                      {saveHashnode.isPending ? "Saving..." : "Save Hashnode Settings"}
                    </button>
                    {saveHashnode.isSuccess && <p className="text-sm text-sf-success">Hashnode settings saved.</p>}
                    {saveHashnode.isError && <p className="text-sm text-sf-error">Failed to save settings.</p>}
                  </div>
                )}

                {!integration.configurable && (
                  <p className="text-xs text-sf-text-muted italic">Coming soon</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
