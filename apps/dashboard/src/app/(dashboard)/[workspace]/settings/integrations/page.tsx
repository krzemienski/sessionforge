"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link2, Link2Off, CheckCircle2, AlertCircle, Save, RefreshCw, Check, Pencil, Github } from "lucide-react";
import { useIntegrations, useUpdateIntegrations } from "@/hooks/use-integrations";
import { timeAgo } from "@/lib/utils";
import GitHubRepositorySelector from "@/components/github-repository-selector";

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

  // ── Ghost integration state ──
  const [ghostUrl, setGhostUrl] = useState("");
  const [ghostAdminKey, setGhostAdminKey] = useState("");
  const [ghostConnectError, setGhostConnectError] = useState<string | null>(null);

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

  // ── Ghost integration queries and mutations ──
  const ghostIntegration = useQuery({
    queryKey: ["ghost-integration", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/ghost?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load Ghost integration status");
      return res.json();
    },
  });

  const ghostConnect = useMutation({
    mutationFn: async ({ url, adminKey }: { url: string; adminKey: string }) => {
      const res = await fetch("/api/integrations/ghost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, ghostUrl: url, adminApiKey: adminKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      return data;
    },
    onSuccess: () => {
      setGhostUrl("");
      setGhostAdminKey("");
      setGhostConnectError(null);
      qc.invalidateQueries({ queryKey: ["ghost-integration", workspace] });
    },
    onError: (err: Error) => {
      setGhostConnectError(err.message);
    },
  });

  const ghostDisconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/ghost?workspace=${workspace}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to disconnect");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ghost-integration", workspace] });
    },
  });

  const isGhostConnected = ghostIntegration.data?.connected === true;

  // ── GitHub integration queries and mutations ──
  const githubIntegration = useQuery({
    queryKey: ["github-integration", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/github?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load GitHub integration status");
      return res.json();
    },
  });

  // ── Medium state ──
  const [mediumApiKey, setMediumApiKey] = useState("");
  const [mediumConnectError, setMediumConnectError] = useState<string | null>(null);

  const mediumIntegration = useQuery({
    queryKey: ["medium-integration", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/medium?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load Medium integration status");
      return res.json();
    },
  });

  const githubRepos = useQuery({
    queryKey: ["github-repos", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/github/repos?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load GitHub repositories");
      return res.json();
    },
    enabled: githubIntegration.data?.connected === true,
  });

  const registerGitHub = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to register GitHub");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["github-integration", workspace] });
    },
  });

  const isGitHubConnected = githubIntegration.data?.connected === true;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_auth") === "complete" && !isGitHubConnected) {
      registerGitHub.mutate();
      // Clean up the URL param
      const url = new URL(window.location.href);
      url.searchParams.delete("github_auth");
      window.history.replaceState({}, "", url.toString());
    }
  }, [isGitHubConnected]);

  const connectGitHub = () => {
    const callbackUrl = encodeURIComponent(
      `/${workspace}/settings/integrations?github_auth=complete`
    );
    window.location.href = `/api/auth/signin/github?callbackURL=${callbackUrl}`;
  };

  const mediumConnect = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch("/api/integrations/medium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, apiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      return data;
    },
    onSuccess: () => {
      setMediumApiKey("");
      setMediumConnectError(null);
      qc.invalidateQueries({ queryKey: ["medium-integration", workspace] });
    },
    onError: (err: Error) => {
      setMediumConnectError(err.message);
    },
  });

  const mediumDisconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/medium?workspace=${workspace}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to disconnect");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medium-integration", workspace] });
    },
  });

  const isMediumConnected = mediumIntegration.data?.connected === true;

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
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 mb-6">
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

        {/* ── Medium Integration ── */}
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-sf bg-sf-bg-tertiary border border-sf-border flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-sf-text-primary">M</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-sf-text-primary">Medium</h2>
                {isMediumConnected ? (
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
                Publish blog posts directly to your Medium account with one click.
              </p>

              {mediumIntegration.isLoading && (
                <div className="animate-pulse h-8 bg-sf-bg-tertiary rounded w-1/3" />
              )}

              {!mediumIntegration.isLoading && isMediumConnected && (
                <div className="space-y-3">
                  <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-4 py-3 text-sm space-y-1">
                    <p className="text-sf-text-primary">
                      <span className="text-sf-text-muted">Account: </span>
                      <span className="font-medium font-code">@{mediumIntegration.data.username}</span>
                    </p>
                    {mediumIntegration.data.connectedAt && (
                      <p className="text-xs text-sf-text-muted">
                        Connected {timeAgo(mediumIntegration.data.connectedAt)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-sf-text-secondary">Update Integration Token</p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={mediumApiKey}
                        onChange={(e) => { setMediumApiKey(e.target.value); setMediumConnectError(null); }}
                        placeholder="Enter new Medium integration token"
                        className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
                      />
                      <button
                        onClick={() => mediumConnect.mutate(mediumApiKey)}
                        disabled={mediumConnect.isPending || !mediumApiKey.trim()}
                        className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                      >
                        <Link2 size={14} />
                        {mediumConnect.isPending ? "Updating..." : "Update"}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => mediumDisconnect.mutate()}
                    disabled={mediumDisconnect.isPending}
                    className="flex items-center gap-2 text-sf-danger border border-sf-danger/30 bg-sf-danger/5 hover:bg-sf-danger/10 px-4 py-2 rounded-sf text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Link2Off size={14} />
                    {mediumDisconnect.isPending ? "Disconnecting..." : "Disconnect Medium"}
                  </button>

                  {mediumDisconnect.isError && (
                    <p className="text-sm text-sf-danger flex items-center gap-1">
                      <AlertCircle size={13} />
                      {(mediumDisconnect.error as Error).message}
                    </p>
                  )}
                </div>
              )}

              {!mediumIntegration.isLoading && !isMediumConnected && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                      Medium Integration Token
                    </label>
                    <input
                      type="password"
                      value={mediumApiKey}
                      onChange={(e) => { setMediumApiKey(e.target.value); setMediumConnectError(null); }}
                      placeholder="Paste your Medium integration token"
                      className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
                    />
                    <p className="text-xs text-sf-text-muted mt-1">
                      Generate an integration token at{" "}
                      <a
                        href="https://medium.com/me/settings/security"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-accent hover:underline"
                      >
                        medium.com/me/settings/security
                      </a>
                    </p>
                  </div>

                  <button
                    onClick={() => mediumConnect.mutate(mediumApiKey)}
                    disabled={mediumConnect.isPending || !mediumApiKey.trim()}
                    className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                  >
                    <Link2 size={14} />
                    {mediumConnect.isPending ? "Connecting..." : "Connect Medium"}
                  </button>
                </div>
              )}

              {mediumConnectError && (
                <p className="text-sm text-sf-danger flex items-center gap-1 mt-2">
                  <AlertCircle size={13} />
                  {mediumConnectError}
                </p>
              )}

              {mediumConnect.isSuccess && (
                <p className="text-sm text-sf-success mt-2">
                  Medium connected as @{mediumIntegration.data?.username}.
                </p>
              )}
            </div>
          </div>
        </div>

      {/* ── Ghost CMS Integration ── */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-sf bg-sf-bg-tertiary border border-sf-border flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-sf-text-primary">G</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-sf-text-primary">Ghost</h2>
              {isGhostConnected ? (
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
              Publish blog posts directly to your self-hosted Ghost CMS instance.
            </p>

            {ghostIntegration.isLoading && (
              <div className="animate-pulse h-8 bg-sf-bg-tertiary rounded w-1/3" />
            )}

            {!ghostIntegration.isLoading && isGhostConnected && (
              <div className="space-y-3">
                <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-4 py-3 text-sm space-y-1">
                  <p className="text-sf-text-primary">
                    <span className="text-sf-text-muted">Connected to: </span>
                    {ghostIntegration.data?.ghostUrl}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => ghostDisconnect.mutate()}
                    disabled={ghostDisconnect.isPending}
                    className="flex items-center gap-2 text-sf-danger border border-sf-danger/30 px-3 py-1.5 rounded-sf text-sm hover:bg-sf-danger/10 transition-colors disabled:opacity-50"
                  >
                    <Link2Off size={13} />
                    {ghostDisconnect.isPending ? "Disconnecting..." : "Disconnect Ghost"}
                  </button>
                </div>
              </div>
            )}

            {!ghostIntegration.isLoading && !isGhostConnected && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-sf-text-muted mb-1">Ghost URL</label>
                  <input
                    type="url"
                    placeholder="https://your-ghost-site.com"
                    value={ghostUrl}
                    onChange={(e) => setGhostUrl(e.target.value)}
                    className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:ring-1 focus:ring-sf-accent/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-sf-text-muted mb-1">Admin API Key</label>
                  <input
                    type="password"
                    placeholder="id:secret"
                    value={ghostAdminKey}
                    onChange={(e) => setGhostAdminKey(e.target.value)}
                    className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:ring-1 focus:ring-sf-accent/50"
                  />
                  <p className="text-xs text-sf-text-muted mt-1">
                    Find your Admin API key in Ghost Admin → Settings → Integrations.
                  </p>
                </div>

                <button
                  onClick={() => ghostConnect.mutate({ url: ghostUrl, adminKey: ghostAdminKey })}
                  disabled={ghostConnect.isPending || !ghostUrl.trim() || !ghostAdminKey.trim()}
                  className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                >
                  <Link2 size={14} />
                  {ghostConnect.isPending ? "Connecting..." : "Connect Ghost"}
                </button>
              </div>
            )}

            {ghostConnectError && (
              <p className="text-sm text-sf-danger flex items-center gap-1 mt-2">
                <AlertCircle size={13} />
                {ghostConnectError}
              </p>
            )}

            {ghostConnect.isSuccess && (
              <p className="text-sm text-sf-success mt-2">
                Ghost connected successfully.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── GitHub Integration ── */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 mt-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-sf bg-sf-bg-tertiary border border-sf-border flex items-center justify-center flex-shrink-0">
            <Github size={20} className="text-sf-text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-sf-text-primary">GitHub</h2>
              {isGitHubConnected ? (
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
              Connect your GitHub repositories to enrich content with commit history, PR descriptions, and code diffs.
            </p>

            {githubIntegration.isLoading && (
              <div className="animate-pulse h-8 bg-sf-bg-tertiary rounded w-1/3" />
            )}

            {!githubIntegration.isLoading && isGitHubConnected && (
              <div className="space-y-3">
                <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-4 py-3 text-sm space-y-1">
                  <p className="text-sf-text-primary">
                    <span className="text-sf-text-muted">Account: </span>
                    <span className="font-medium font-code">@{githubIntegration.data.username}</span>
                  </p>
                  {githubIntegration.data.connectedAt && (
                    <p className="text-xs text-sf-text-muted">
                      Connected {timeAgo(githubIntegration.data.connectedAt)}
                    </p>
                  )}
                </div>

                {githubRepos.isLoading && (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-sf-bg-tertiary rounded w-1/4" />
                    <div className="h-16 bg-sf-bg-tertiary rounded" />
                  </div>
                )}

                {!githubRepos.isLoading && githubRepos.data?.connected && githubRepos.data.connected.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-sf-text-secondary">
                      Connected Repositories ({githubRepos.data.connected.length})
                    </p>
                    <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-4 py-3 space-y-2">
                      {githubRepos.data.connected.map((repo: any) => (
                        <div key={repo.id} className="flex items-center justify-between text-sm">
                          <div className="flex-1 min-w-0">
                            <a
                              href={repo.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sf-accent hover:underline font-code font-medium"
                            >
                              {repo.repoName}
                            </a>
                            {repo.lastSyncedAt && (
                              <p className="text-xs text-sf-text-muted mt-0.5">
                                Last synced {timeAgo(repo.lastSyncedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!githubRepos.isLoading && (!githubRepos.data?.connected || githubRepos.data.connected.length === 0) && (
                  <p className="text-sm text-sf-text-muted">
                    No repositories connected yet. Use the repository selector to connect repositories.
                  </p>
                )}

                <div className="mt-4">
                  <GitHubRepositorySelector workspace={workspace} />
                </div>
              </div>
            )}

            {!githubIntegration.isLoading && !isGitHubConnected && (
              <div className="space-y-3">
                <p className="text-sm text-sf-text-secondary">
                  Connect your GitHub account to access repository data, commits, and pull requests for content generation.
                </p>

                <button
                  onClick={connectGitHub}
                  className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
                >
                  <Github size={14} />
                  Connect GitHub
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
