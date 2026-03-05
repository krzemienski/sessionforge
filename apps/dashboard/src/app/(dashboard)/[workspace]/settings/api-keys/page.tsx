"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Plus, Trash2, Copy, Check } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export default function ApiKeysPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [keyName, setKeyName] = useState("My API Key");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const keys = useQuery({
    queryKey: ["api-keys", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/api-keys?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, workspaceSlug: workspace }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setNewKey(data.key);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const keyList = keys.data?.keys ?? [];

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">API Keys</h1>
        <button
          onClick={() => { setShowForm(!showForm); setNewKey(null); }}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
        >
          <Plus size={16} /> New Key
        </button>
      </div>

      {newKey && (
        <div className="bg-sf-success/10 border border-sf-success/30 rounded-sf-lg p-4 mb-6">
          <p className="text-sm text-sf-success font-medium mb-2">API key created. Copy it now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-sf-bg-tertiary px-3 py-2 rounded-sf text-sm text-sf-accent font-code break-all">{newKey}</code>
            <button onClick={handleCopy} className="text-sf-text-secondary hover:text-sf-text-primary p-2">
              {copied ? <Check size={16} className="text-sf-success" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      )}

      {showForm && !newKey && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-3">
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name"
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={() => create.mutate(keyName)}
              disabled={create.isPending}
              className="bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium disabled:opacity-50"
            >
              {create.isPending ? "Creating..." : "Create Key"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sf-text-secondary px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {keyList.map((k: any) => (
          <div key={k.id} className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sf-text-primary text-sm">{k.name}</h3>
              <p className="text-xs text-sf-text-muted mt-1">
                {k.maskedKey} · Created {k.createdAt ? timeAgo(k.createdAt) : "recently"}
                {k.lastUsedAt && ` · Last used ${timeAgo(k.lastUsedAt)}`}
              </p>
            </div>
            <button onClick={() => del.mutate(k.id)} className="text-sf-text-muted hover:text-sf-danger transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {keyList.length === 0 && !keys.isLoading && (
          <div className="text-center py-12">
            <KeyRound size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-secondary">No API keys yet. Create one for external integrations.</p>
          </div>
        )}
      </div>
    </div>
  );
}
