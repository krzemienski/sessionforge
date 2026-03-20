"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";

interface IntegrationHealthPanelProps {
  workspace: string;
}

type Platform = "devto" | "ghost" | "medium" | "twitter" | "linkedin" | "wordpress";
type HealthStatus = "healthy" | "degraded" | "unhealthy" | "auth_expired" | "paused";

interface IntegrationHealth {
  platform: Platform;
  status: HealthStatus;
  lastCheckedAt: string | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  connectedAt: string | null;
  enabled: boolean;
}

interface HealthResponse {
  integrations: IntegrationHealth[];
}

interface CheckResponse {
  checked: number;
  results: {
    platform: Platform;
    status: HealthStatus;
    responseTimeMs: number | null;
    errorMessage: string | null;
    errorCode: string | null;
  }[];
}

const PLATFORM_LABELS: Record<Platform, string> = {
  devto: "Dev.to",
  ghost: "Ghost",
  medium: "Medium",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  wordpress: "WordPress",
};

const PLATFORM_SETUP_URLS: Record<Platform, string> = {
  devto: "/settings?tab=integrations",
  ghost: "/settings?tab=integrations",
  medium: "/settings?tab=integrations",
  twitter: "/settings?tab=integrations",
  linkedin: "/settings?tab=integrations",
  wordpress: "/settings?tab=integrations",
};

const STATUS_CONFIG: Record<HealthStatus, { label: string; className: string }> = {
  healthy: {
    label: "Healthy",
    className: "bg-sf-success/10 text-sf-success",
  },
  degraded: {
    label: "Degraded",
    className: "bg-yellow-500/10 text-yellow-500",
  },
  unhealthy: {
    label: "Unhealthy",
    className: "bg-sf-error/10 text-sf-error",
  },
  auth_expired: {
    label: "Auth Expired",
    className: "bg-sf-error/10 text-sf-error",
  },
  paused: {
    label: "Paused",
    className: "bg-sf-bg-tertiary text-sf-text-muted",
  },
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export function IntegrationHealthPanel({ workspace }: IntegrationHealthPanelProps) {
  const qc = useQueryClient();

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

  const checkNow = useMutation<CheckResponse>({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/health/check?workspace=${encodeURIComponent(workspace)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Health check failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration-health", workspace] });
    },
  });

  if (health.isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-sf-bg-tertiary rounded w-1/3" />
        <div className="h-24 bg-sf-bg-tertiary rounded" />
      </div>
    );
  }

  const integrations = health.data?.integrations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-sf-accent" />
          <h2 className="text-base font-semibold font-display">Integration Health</h2>
        </div>
        <button
          onClick={() => checkNow.mutate()}
          disabled={checkNow.isPending}
          className="flex items-center gap-2 bg-sf-bg-secondary border border-sf-border px-3 py-1.5 rounded-sf text-sm text-sf-text-secondary hover:text-sf-text-primary hover:border-sf-border-focus transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={checkNow.isPending ? "animate-spin" : ""} />
          {checkNow.isPending ? "Checking..." : "Check Now"}
        </button>
      </div>

      {checkNow.isError && (
        <p className="text-sm text-sf-error">
          {(checkNow.error as Error).message}
        </p>
      )}

      {health.isError && (
        <p className="text-sm text-sf-error">Failed to load health data.</p>
      )}

      {integrations.length === 0 && !health.isError && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-5">
          <p className="text-sm text-sf-text-muted">
            No connected integrations found. Connect an integration to monitor its health.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {integrations.map((integration) => {
          const statusConfig = STATUS_CONFIG[integration.status] ?? STATUS_CONFIG.healthy;

          return (
            <div
              key={integration.platform}
              className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-sf-text-primary">
                  {PLATFORM_LABELS[integration.platform] ?? integration.platform}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.className}`}
                >
                  {statusConfig.label}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-sf-text-muted mb-2">
                <span>
                  Last checked: {formatTimestamp(integration.lastCheckedAt)}
                </span>
                {integration.responseTimeMs !== null && (
                  <span>Response: {integration.responseTimeMs}ms</span>
                )}
                {!integration.enabled && (
                  <span className="text-yellow-500">Disabled</span>
                )}
              </div>

              {integration.errorMessage && (
                <p className="text-xs text-sf-error mt-1">
                  {integration.errorCode ? `[${integration.errorCode}] ` : ""}
                  {integration.errorMessage}
                </p>
              )}

              {integration.status === "auth_expired" && (
                <div className="mt-3 p-3 bg-sf-error/5 border border-sf-error/20 rounded-sf">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-sf-error mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-sf-error">
                        Authentication expired
                      </p>
                      <p className="text-xs text-sf-text-secondary mt-0.5">
                        This integration&apos;s credentials have expired. Reconnect to resume publishing.
                      </p>
                      <a
                        href={PLATFORM_SETUP_URLS[integration.platform]}
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-sf-accent hover:text-sf-accent-dim transition-colors"
                      >
                        <ExternalLink size={12} />
                        Reconnect {PLATFORM_LABELS[integration.platform]}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
