"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Link2, Save, RefreshCw, Check, AlertCircle, Pencil } from "lucide-react";
import { useIntegrations, useUpdateIntegrations } from "@/hooks/use-integrations";

interface HashnodePublication {
  id: string;
  title: string;
}

export default function IntegrationsPage() {
  const { workspace } = useParams<{ workspace: string }>();

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

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
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
    </div>
  );
}
