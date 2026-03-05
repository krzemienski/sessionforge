"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Globe, CheckCircle, X, Loader2, Plug, PlugZap } from "lucide-react";

type WpConnection = {
  connected: boolean;
  siteUrl?: string;
  username?: string;
};

type TestResult = {
  success: boolean;
  siteTitle?: string;
  categories?: { id: number; name: string }[];
  tags?: { id: number; name: string }[];
  error?: string;
};

export default function WordPressSettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();

  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const connection = useQuery<WpConnection>({
    queryKey: ["wordpress-connection", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/wordpress`);
      if (!res.ok) throw new Error("Failed to fetch WordPress connection");
      return res.json();
    },
  });

  const connect = useMutation({
    mutationFn: async (data: {
      siteUrl: string;
      username: string;
      appPassword: string;
    }) => {
      const res = await fetch(`/api/workspace/${workspace}/wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save connection");
      return res.json();
    },
    onSuccess: () => {
      setSiteUrl("");
      setUsername("");
      setAppPassword("");
      qc.invalidateQueries({ queryKey: ["wordpress-connection", workspace] });
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/wordpress`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wordpress-connection", workspace] });
    },
  });

  const test = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/wordpress/test`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Connection test failed");
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (data) => {
      setTestResult(data);
    },
  });

  const data = connection.data;
  const isConnected = data?.connected === true;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">WordPress Integration</h1>
      </div>

      {connection.isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-sf-bg-tertiary rounded-sf-lg" />
        </div>
      ) : isConnected ? (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-sf-success mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-sf-success">Connected</p>
              <p className="text-sm text-sf-text-primary mt-0.5">{data?.siteUrl}</p>
              <p className="text-xs text-sf-text-muted mt-0.5">Logged in as <span className="text-sf-text-secondary font-medium">{data?.username}</span></p>
            </div>
          </div>

          {test.isError && (
            <div className="bg-sf-danger/10 border border-sf-danger/30 rounded-sf p-3">
              <p className="text-sm text-sf-danger">
                {test.error instanceof Error ? test.error.message : "Connection test failed"}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => test.mutate()}
              disabled={test.isPending}
              className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf text-sm font-medium hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
            >
              {test.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <PlugZap size={15} />
              )}
              {test.isPending ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="flex items-center gap-2 text-sf-danger border border-sf-danger/30 bg-sf-danger/5 hover:bg-sf-danger/10 px-4 py-2 rounded-sf text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Plug size={15} />
              {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
          <div className="flex items-center gap-2 text-sf-text-muted mb-1">
            <Globe size={18} />
            <span className="text-sm">Connect your WordPress site to enable one-click publishing.</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-sf-text-secondary mb-1">
              Site URL
            </label>
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://myblog.com"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sf-text-secondary mb-1">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your-wp-username"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sf-text-secondary mb-1">
              Application Password
            </label>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
            <p className="text-xs text-sf-text-muted mt-1">
              Generate in WordPress Admin → Users → Profile → Application Passwords.
            </p>
          </div>

          {connect.isError && (
            <div className="bg-sf-danger/10 border border-sf-danger/30 rounded-sf p-3">
              <p className="text-sm text-sf-danger">
                {connect.error instanceof Error ? connect.error.message : "Failed to connect"}
              </p>
            </div>
          )}

          <button
            onClick={() =>
              connect.mutate({ siteUrl: siteUrl.trim(), username: username.trim(), appPassword })
            }
            disabled={connect.isPending || !siteUrl.trim() || !username.trim() || !appPassword.trim()}
            className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            {connect.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Globe size={15} />
            )}
            {connect.isPending ? "Connecting..." : "Connect WordPress"}
          </button>
        </div>
      )}

      {/* Test Connection Result Modal */}
      {testResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-sf-border">
              <h2 className="text-base font-semibold text-sf-text-primary">Connection Test</h2>
              <button
                onClick={() => setTestResult(null)}
                className="text-sf-text-muted hover:text-sf-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {testResult.success ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-sf-success" />
                    <span className="text-sm font-medium text-sf-success">Connection successful</span>
                  </div>

                  {testResult.siteTitle && (
                    <div>
                      <p className="text-xs text-sf-text-muted uppercase tracking-wide mb-1">Site</p>
                      <p className="text-sm text-sf-text-primary font-medium">{testResult.siteTitle}</p>
                    </div>
                  )}

                  {testResult.categories && testResult.categories.length > 0 && (
                    <div>
                      <p className="text-xs text-sf-text-muted uppercase tracking-wide mb-2">
                        Categories ({testResult.categories.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {testResult.categories.map((cat) => (
                          <span
                            key={cat.id}
                            className="bg-sf-accent-bg text-sf-accent text-xs px-2 py-0.5 rounded border border-sf-accent/20"
                          >
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {testResult.tags && testResult.tags.length > 0 && (
                    <div>
                      <p className="text-xs text-sf-text-muted uppercase tracking-wide mb-2">
                        Tags ({testResult.tags.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {testResult.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="bg-sf-bg-tertiary text-sf-text-secondary text-xs px-2 py-0.5 rounded border border-sf-border"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <X size={18} className="text-sf-danger mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-sf-danger">Connection failed</p>
                    {testResult.error && (
                      <p className="text-xs text-sf-text-muted mt-1">{testResult.error}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-sf-border flex justify-end">
              <button
                onClick={() => setTestResult(null)}
                className="bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf text-sm hover:bg-sf-bg-hover transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
