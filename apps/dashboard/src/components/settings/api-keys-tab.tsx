"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";

interface ApiKeysTabProps {
  workspace: string;
}

export function ApiKeysTab({ workspace }: ApiKeysTabProps) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const keys = useQuery({
    queryKey: ["api-keys", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/api-keys?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, name }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setRevealedKey(data.key);
      setNewKeyName("");
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["api-keys", workspace] });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys", workspace] }),
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  if (keys.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  return (
    <div className="space-y-6">
      {revealedKey && (
        <div className="bg-sf-warning/10 border border-sf-warning/30 rounded-sf-lg p-4 space-y-2">
          <p className="text-sm font-medium text-sf-warning">Save your API key now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code break-all">{revealedKey}</code>
            <button onClick={() => handleCopy(revealedKey, "new-key")} className="flex items-center gap-1.5 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-secondary hover:bg-sf-bg-hover transition-colors">
              {copiedField === "new-key" ? <Check size={14} className="text-sf-success" /> : <Copy size={14} />}
              {copiedField === "new-key" ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors">Dismiss</button>
        </div>
      )}

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-sf-accent" />
            <h2 className="text-base font-semibold font-display">API Keys</h2>
          </div>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors">
              <Plus size={14} /> New Key
            </button>
          )}
        </div>

        {showCreate && (
          <div className="flex items-end gap-3 mb-4 p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
            <div className="flex-1">
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">Key Name</label>
              <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production API" className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
            </div>
            <button onClick={() => { if (newKeyName.trim()) createKey.mutate(newKeyName.trim()); }} disabled={!newKeyName.trim() || createKey.isPending} className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50">
              {createKey.isPending ? "Creating..." : "Create"}
            </button>
            <button onClick={() => { setShowCreate(false); setNewKeyName(""); }} className="px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors">Cancel</button>
          </div>
        )}

        {keys.data?.keys?.length > 0 ? (
          <div className="space-y-2">
            {keys.data.keys.map((k: { id: string; name: string; keyPrefix: string; lastUsedAt: string | null; createdAt: string }) => (
              <div key={k.id} className="flex items-center justify-between p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-sf-text-primary">{k.name}</span>
                    <code className="text-xs text-sf-text-muted font-code">{k.keyPrefix}...</code>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-sf-text-muted">
                    <span>Created {new Date(k.createdAt).toLocaleDateString()}</span>
                    {k.lastUsedAt && <span>Last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <button onClick={() => deleteKey.mutate(k.id)} disabled={deleteKey.isPending} className="p-2 text-sf-text-muted hover:text-sf-error transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Key size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-muted">No API keys yet</p>
            <p className="text-xs text-sf-text-muted mt-1">Create an API key to access the SessionForge API programmatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
