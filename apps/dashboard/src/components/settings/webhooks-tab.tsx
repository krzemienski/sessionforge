"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Webhook, Plus, Trash2, Copy, Check, ToggleLeft, ToggleRight } from "lucide-react";

interface WebhooksTabProps {
  workspace: string;
}

const WEBHOOK_EVENTS = [
  "content.created",
  "content.updated",
  "content.published",
  "content.deleted",
  "session.created",
  "session.updated",
  "insight.created",
] as const;

export function WebhooksTab({ workspace }: WebhooksTabProps) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const webhooks = useQuery({
    queryKey: ["webhooks", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/webhooks?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createWebhook = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, url: newUrl, events: selectedEvents }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setRevealedSecret(data.secret);
      setNewUrl("");
      setSelectedEvents([]);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["webhooks", workspace] });
    },
  });

  const toggleWebhook = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks", workspace] }),
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks", workspace] }),
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (webhooks.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  return (
    <div className="space-y-6">
      {revealedSecret && (
        <div className="bg-sf-warning/10 border border-sf-warning/30 rounded-sf-lg p-4 space-y-2">
          <p className="text-sm font-medium text-sf-warning">Save your signing secret now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code break-all">{revealedSecret}</code>
            <button onClick={() => handleCopy(revealedSecret, "secret")} className="flex items-center gap-1.5 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-secondary hover:bg-sf-bg-hover transition-colors">
              {copiedField === "secret" ? <Check size={14} className="text-sf-success" /> : <Copy size={14} />}
              {copiedField === "secret" ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setRevealedSecret(null)} className="text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors">Dismiss</button>
        </div>
      )}

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Webhook size={18} className="text-sf-accent" />
            <h2 className="text-base font-semibold font-display">Webhooks</h2>
          </div>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors">
              <Plus size={14} /> New Webhook
            </button>
          )}
        </div>

        {showCreate && (
          <div className="mb-4 p-4 bg-sf-bg-tertiary border border-sf-border rounded-sf space-y-3">
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">Endpoint URL</label>
              <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/webhook" className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
            </div>
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">Events</label>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <button key={event} onClick={() => toggleEvent(event)} className={`px-2.5 py-1 rounded-sf text-xs font-code transition-colors ${selectedEvents.includes(event) ? "bg-sf-accent text-sf-bg-primary" : "bg-sf-bg-primary border border-sf-border text-sf-text-secondary hover:border-sf-border-focus"}`}>
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => createWebhook.mutate()} disabled={!newUrl.trim() || selectedEvents.length === 0 || createWebhook.isPending} className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50">
                {createWebhook.isPending ? "Creating..." : "Create Webhook"}
              </button>
              <button onClick={() => { setShowCreate(false); setNewUrl(""); setSelectedEvents([]); }} className="px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {webhooks.data?.endpoints?.length > 0 ? (
          <div className="space-y-2">
            {webhooks.data.endpoints.map((wh: { id: string; url: string; events: string[]; enabled: boolean; createdAt: string }) => (
              <div key={wh.id} className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wh.enabled ? "bg-sf-success" : "bg-sf-text-muted"}`} />
                    <span className="text-sm font-code text-sf-text-primary truncate">{wh.url}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleWebhook.mutate({ id: wh.id, enabled: !wh.enabled })} className="p-2 text-sf-text-muted hover:text-sf-text-primary transition-colors" title={wh.enabled ? "Disable" : "Enable"}>
                      {wh.enabled ? <ToggleRight size={18} className="text-sf-success" /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => deleteWebhook.mutate(wh.id)} disabled={deleteWebhook.isPending} className="p-2 text-sf-text-muted hover:text-sf-error transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {wh.events.map((event: string) => (
                    <span key={event} className="px-1.5 py-0.5 bg-sf-bg-primary border border-sf-border rounded text-xs font-code text-sf-text-muted">{event}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Webhook size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-muted">No webhooks configured</p>
            <p className="text-xs text-sf-text-muted mt-1">Set up webhooks to receive real-time notifications when events occur.</p>
          </div>
        )}
      </div>
    </div>
  );
}
