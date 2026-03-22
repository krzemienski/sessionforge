"use client";

import { useState } from "react";
import {
  Server,
  Plus,
  Trash2,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  useScanSources,
  useCreateScanSource,
  useDeleteScanSource,
  useUpdateScanSource,
  useCheckScanSource,
} from "@/hooks/use-scan-sources";

interface SourcesTabProps {
  workspace: string;
}

export function SourcesTab({ workspace }: SourcesTabProps) {
  const { sources, isLoading } = useScanSources(workspace);
  const createSource = useCreateScanSource(workspace);
  const deleteSource = useDeleteScanSource(workspace);
  const updateSource = useUpdateScanSource(workspace);
  const { check, isChecking, checkResult, clearResult } = useCheckScanSource(workspace);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [basePath, setBasePath] = useState("~/.claude");
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const resetForm = () => {
    setLabel(""); setHost(""); setPort("22");
    setUsername(""); setPassword(""); setBasePath("~/.claude");
  };

  const handleCreate = () => {
    createSource.mutate(
      { label, host, port: parseInt(port) || 22, username, password, basePath: basePath || "~/.claude" },
      { onSuccess: () => { resetForm(); setShowForm(false); } }
    );
  };

  const handleCheck = (id: string) => {
    setCheckingId(id);
    clearResult();
    check(id);
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-sf-accent" />
            <h2 className="text-base font-semibold font-display">SSH Scan Sources</h2>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
            >
              <Plus size={14} /> Add Source
            </button>
          )}
        </div>

        <p className="text-sm text-sf-text-muted mb-4">
          Configure remote hosts to scan for Claude session files via SSH/SFTP.
        </p>

        {showForm && (
          <div className="mb-4 p-4 bg-sf-bg-tertiary border border-sf-border rounded-sf space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">Label</label>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My Dev Server" className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
              </div>
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">Host</label>
                <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
              </div>
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">Port</label>
                <input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="22" className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
              </div>
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="nick" className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
              </div>
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
              </div>
              <div>
                <label className="block text-sm font-medium text-sf-text-secondary mb-1">Base Path</label>
                <input value={basePath} onChange={(e) => setBasePath(e.target.value)} placeholder="~/.claude" className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreate}
                disabled={!label.trim() || !host.trim() || !username.trim() || !password.trim() || createSource.isPending}
                className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
              >
                {createSource.isPending ? "Adding..." : "Add Source"}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {sources.length > 0 ? (
          <div className="space-y-2">
            {sources.map((source) => (
              <div key={source.id} className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Server size={14} className="text-sf-accent flex-shrink-0" />
                    <span className="text-sm font-medium text-sf-text-primary truncate">{source.label}</span>
                    <span className="text-xs text-sf-text-muted font-code">
                      {source.username}@{source.host}:{source.port ?? 22}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleCheck(source.id)}
                      disabled={isChecking && checkingId === source.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-sf-border rounded-sf hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
                      title="Check Connection"
                    >
                      {isChecking && checkingId === source.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Zap size={12} />
                      )}
                      Check
                    </button>
                    <button
                      onClick={() => updateSource.mutate({ id: source.id, enabled: !source.enabled })}
                      className="p-1.5 text-sf-text-muted hover:text-sf-text-primary transition-colors"
                      title={source.enabled ? "Disable" : "Enable"}
                      aria-label={source.enabled ? "Disable source" : "Enable source"}
                    >
                      {source.enabled ? <ToggleRight size={18} className="text-sf-success" /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${source.label}"?`)) deleteSource.mutate(source.id); }}
                      disabled={deleteSource.isPending}
                      className="p-1.5 text-sf-text-muted hover:text-sf-error transition-colors"
                      aria-label={`Delete source ${source.label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-sf-text-muted">
                  <span>Path: {source.basePath ?? "~/.claude"}</span>
                  {source.lastScannedAt && (
                    <span>Last scanned: {new Date(source.lastScannedAt).toLocaleDateString()}</span>
                  )}
                </div>

                {checkResult && checkingId === source.id && !isChecking && (
                  <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-sf ${
                    checkResult.success
                      ? "bg-sf-success/10 text-sf-success"
                      : "bg-sf-error/10 text-sf-error"
                  }`}>
                    {checkResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {checkResult.success ? checkResult.message : checkResult.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !showForm ? (
          <div className="text-center py-8">
            <Server size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-muted">No remote sources configured</p>
            <p className="text-xs text-sf-text-muted mt-1">Add an SSH source to scan sessions from other machines.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
