"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link2, Link2Off, CheckCircle2, AlertCircle, Save, RefreshCw, Check, Pencil } from "lucide-react";
import { useIntegrations, useUpdateIntegrations } from "@/hooks/use-integrations";
import { timeAgo } from "@/lib/utils";

interface HashnodePublication {
  id: string;
  title: string;
}

export default function IntegrationsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();

  // ── Hashnode state ──
  const integrations = useIntegrations(workspace);
  const update = useUpdateIntegrations();
  const [tokenInput, setTokenInput] = useState("");
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [publicationId, setPublicationId] = useState("");
  const [canonicalDomain, setCanonicalDomain] = useState("");
  const [publications, setPublications] = useState<HashnodePublication[]>([]);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    if (integrations.data) {
      setPublicationId(integrations.data.hashnodePublicationId ?? "");
      setCanonicalDomain(integrations.data.hashnodeDefaultCanonicalDomain ?? "");
    }
  }, [integrations.data]);

  const hasSavedToken = !!integrations.data?.hashnodeApiToken;

  async function handleTestConnection() {
    if (!tokenInput.trim()) {
      setTestError("Enter an API token to test.");
      return;
    }
    setTesting(true);
    setTestError(null);
    setTestSuccess(false);
    setPublications([]);
    try {
      const res = await fetch("https://gql.hashnode.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: tokenInput.trim(),
        },
        body: JSON.stringify({
          query: `query { me { publications(first: 20) { edges { node { id title } } } } }`,
        }),
      });
      const json = await res.json();
      if (json.errors?.length) {
        throw new Error(json.errors[0].message);
      }
      const pubs: HashnodePublication[] =
        json.data?.me?.publications?.edges?.map(
          (e: { node: HashnodePublication }) => e.node
        ) ?? [];
      setPublications(pubs);
      setTestSuccess(true);
      if (pubs.length === 0) {
        setTestError("Token is valid but no publications found on this account.");
      }
    } catch (err) {
      setTestError(
        err instanceof Error ? err.message : "Connection failed. Check your token."
      );
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    const data: {
      workspace: string;
      hashnodeToken?: string;
      hashnodePublicationId?: string;
      hashnodeDefaultCanonicalDomain?: string;
    } = {
      workspace,
      hashnodePublicationId: publicationId,
      hashnodeDefaultCanonicalDomain: canonicalDomain,
    };
    if (isEditingToken || !hasSavedToken) {
      data.hashnodeToken = tokenInput;
    }
    update.mutate(data, {
      onSuccess: () => {
        setIsEditingToken(false);
        setTokenInput("");
        setPublications([]);
        setTestError(null);
        setTestSuccess(false);
      },
    });
  }

  // ── Dev.to state ──
  const [apiKey, setApiKey] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);

  const devtoIntegration = useQuery({
    queryKey: ["devto-integration", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/devto?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load integration status");
      return res.json();
    },
  });

  const devtoConnect = useMutation({
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

  const devtoDisconnect = useMutation({
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

  const isDevtoConnected = devtoIntegration.data?.connected === true;

  if (integrations.isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-sf-bg-tertiary rounded w-1/3" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Integrations</h1>
      </div>

      {/* ── Hashnode Integration ── */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5 mb-6">
        <div className="flex items-center gap-3 pb-4 border-b border-sf-border">
          <Link2 size={20} className="text-sf-accent" />
          <div>
            <h2 className="font-semibold text-sf-text-primary">Hashnode</h2>
            <p className="text-xs text-sf-text-muted">
              Connect your Hashnode publication to publish blog posts directly.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">
            Personal Access Token
          </label>
          {hasSavedToken && !isEditingToken ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-muted font-code flex items-center gap-2">
                <Check size={14} className="text-sf-success" />
                {integrations.data?.hashnodeApiToken}
              </div>
              <button
                onClick={() => {
                  setIsEditingToken(true);
                  setTokenInput("");
                  setPublications([]);
                  setTestError(null);
                  setTestSuccess(false);
                }}
                className="flex items-center gap-2 border border-sf-border bg-sf-bg-tertiary text-sf-text-secondary px-3 py-2 rounded-sf text-sm hover:bg-sf-bg-hover hover:text-sf-text-primary transition-colors"
              >
                <Pencil size={14} />
                Change
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your Hashnode Personal Access Token"
                className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus"
              />
              <button
                onClick={handleTestConnection}
                disabled={testing || !tokenInput.trim()}
                className="flex items-center gap-2 border border-sf-border bg-sf-bg-tertiary text-sf-text-secondary px-3 py-2 rounded-sf text-sm hover:bg-sf-bg-hover hover:text-sf-text-primary transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={testing ? "animate-spin" : ""} />
                {testing ? "Testing..." : "Test Connection"}
              </button>
            </div>
          )}
          <p className="text-xs text-sf-text-muted mt-1">
            Generate at{" "}
            <a
              href="https://hashnode.com/settings/developer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sf-accent hover:underline"
            >
              hashnode.com/settings/developer
            </a>
          </p>
        </div>

        {testError && (
          <div className="flex items-start gap-2 bg-sf-danger/10 border border-sf-danger/30 rounded-sf p-3">
            <AlertCircle size={16} className="text-sf-danger mt-0.5 shrink-0" />
            <p className="text-sm text-sf-danger">{testError}</p>
          </div>
        )}

        {testSuccess && publications.length > 0 && (
          <div>
            <p className="text-xs font-medium text-sf-text-secondary mb-2 flex items-center gap-1">
              <Check size={12} className="text-sf-success" />
              Connection verified — select a publication to auto-fill the ID:
            </p>
            <div className="space-y-1">
              {publications.map((pub) => (
                <button
                  key={pub.id}
                  onClick={() => setPublicationId(pub.id)}
                  className={`w-full text-left px-3 py-2 rounded-sf text-sm transition-colors ${
                    publicationId === pub.id
                      ? "bg-sf-accent-bg text-sf-accent border border-sf-accent/30"
                      : "bg-sf-bg-tertiary text-sf-text-primary border border-sf-border hover:bg-sf-bg-hover"
                  }`}
                >
                  <span className="font-medium">{pub.title}</span>
                  <span className="ml-2 text-xs text-sf-text-muted font-code">
                    {pub.id}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">
            Publication ID
          </label>
          <input
            value={publicationId}
            onChange={(e) => setPublicationId(e.target.value)}
            placeholder="e.g. 6734d1c4ee45a1c8c24cdfe5"
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus"
          />
          <p className="text-xs text-sf-text-muted mt-1">
            Use Test Connection above to find and auto-fill your publication ID.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">
            Default Canonical Domain{" "}
            <span className="font-normal text-sf-text-muted">(optional)</span>
          </label>
          <input
            value={canonicalDomain}
            onChange={(e) => setCanonicalDomain(e.target.value)}
            placeholder="e.g. https://yourblog.com"
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus"
          />
          <p className="text-xs text-sf-text-muted mt-1">
            When set, published posts will use this domain as the canonical URL origin.
          </p>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {update.isPending ? "Saving..." : "Save Integration"}
          </button>

          {isEditingToken && hasSavedToken && (
            <button
              onClick={() => {
                setIsEditingToken(false);
                setTokenInput("");
                setPublications([]);
                setTestError(null);
                setTestSuccess(false);
              }}
              className="text-sm text-sf-text-muted hover:text-sf-text-primary transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {update.isSuccess && (
          <p className="text-sm text-sf-success">
            Hashnode integration saved successfully.
          </p>
        )}
        {update.isError && (
          <p className="text-sm text-sf-danger">
            Failed to save integration. Please try again.
          </p>
        )}
      </div>

      {/* ── Dev.to Integration ── */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-sf bg-sf-bg-tertiary border border-sf-border flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-sf-text-primary">D</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-sf-text-primary">Dev.to</h2>
              {isDevtoConnected ? (
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

            {devtoIntegration.isLoading && (
              <div className="animate-pulse h-8 bg-sf-bg-tertiary rounded w-1/3" />
            )}

            {!devtoIntegration.isLoading && isDevtoConnected && (
              <div className="space-y-3">
                <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-4 py-3 text-sm space-y-1">
                  <p className="text-sf-text-primary">
                    <span className="text-sf-text-muted">Account: </span>
                    <span className="font-medium font-code">@{devtoIntegration.data.username}</span>
                  </p>
                  {devtoIntegration.data.connectedAt && (
                    <p className="text-xs text-sf-text-muted">
                      Connected {timeAgo(devtoIntegration.data.connectedAt)}
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
                      onClick={() => devtoConnect.mutate(apiKey)}
                      disabled={devtoConnect.isPending || !apiKey.trim()}
                      className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                    >
                      <Link2 size={14} />
                      {devtoConnect.isPending ? "Updating..." : "Update"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => devtoDisconnect.mutate()}
                  disabled={devtoDisconnect.isPending}
                  className="flex items-center gap-2 text-sf-danger border border-sf-danger/30 bg-sf-danger/5 hover:bg-sf-danger/10 px-4 py-2 rounded-sf text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Link2Off size={14} />
                  {devtoDisconnect.isPending ? "Disconnecting..." : "Disconnect Dev.to"}
                </button>

                {devtoDisconnect.isError && (
                  <p className="text-sm text-sf-danger flex items-center gap-1">
                    <AlertCircle size={13} />
                    {(devtoDisconnect.error as Error).message}
                  </p>
                )}
              </div>
            )}

            {!devtoIntegration.isLoading && !isDevtoConnected && (
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
                  onClick={() => devtoConnect.mutate(apiKey)}
                  disabled={devtoConnect.isPending || !apiKey.trim()}
                  className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                >
                  <Link2 size={14} />
                  {devtoConnect.isPending ? "Connecting..." : "Connect Dev.to"}
                </button>
              </div>
            )}

            {connectError && (
              <p className="text-sm text-sf-danger flex items-center gap-1 mt-2">
                <AlertCircle size={13} />
                {connectError}
              </p>
            )}

            {devtoConnect.isSuccess && (
              <p className="text-sm text-sf-success mt-2">
                Dev.to connected as @{devtoIntegration.data?.username}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
