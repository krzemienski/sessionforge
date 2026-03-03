"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Webhook, Plus, Trash2, Copy, Check } from "lucide-react";
import { timeAgo } from "@/lib/utils";

const ALL_EVENTS = [
  "content.generated",
  "content.published",
  "insight.extracted",
  "scan.completed",
  "automation.completed",
] as const;

type WebhookEvent = (typeof ALL_EVENTS)[number];

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function WebhooksPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<WebhookEvent>>(
    new Set(ALL_EVENTS)
  );
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const endpoints = useQuery({
    queryKey: ["webhooks", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/webhooks?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async ({
      url,
      events,
    }: {
      url: string;
      events: string[];
    }) => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace, url, events }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setNewSecret(data.secret);
      setWebhookUrl("");
      setSelectedEvents(new Set(ALL_EVENTS));
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const endpointList: WebhookEndpoint[] = endpoints.data?.endpoints ?? [];

  function toggleEvent(event: WebhookEvent) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        next.delete(event);
      } else {
        next.add(event);
      }
      return next;
    });
  }

  function handleCreate() {
    if (!webhookUrl || selectedEvents.size === 0) return;
    create.mutate({ url: webhookUrl, events: Array.from(selectedEvents) });
  }

  function handleCopy() {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleNewWebhook() {
    setShowForm(!showForm);
    setNewSecret(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Webhooks</h1>
        <button
          onClick={handleNewWebhook}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
        >
          <Plus size={16} /> New Webhook
        </button>
      </div>

      {newSecret && (
        <div className="bg-sf-success/10 border border-sf-success/30 rounded-sf-lg p-4 mb-6">
          <p className="text-sm text-sf-success font-medium mb-2">
            Webhook created. Copy your signing secret now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-sf-bg-tertiary px-3 py-2 rounded-sf text-sm text-sf-accent font-code break-all">
              {newSecret}
            </code>
            <button
              onClick={handleCopy}
              className="text-sf-text-secondary hover:text-sf-text-primary p-2"
            >
              {copied ? (
                <Check size={16} className="text-sf-success" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
        </div>
      )}

      {showForm && !newSecret && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-sf-text-secondary mb-1">
              Endpoint URL
            </label>
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhooks"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-sf-text-secondary mb-2">
              Events to subscribe
            </p>
            <div className="space-y-2">
              {ALL_EVENTS.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(event)}
                    onChange={() => toggleEvent(event)}
                    className="accent-sf-accent"
                  />
                  <span className="text-sm text-sf-text-primary font-code">
                    {event}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={
                create.isPending ||
                !webhookUrl ||
                selectedEvents.size === 0
              }
              className="bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium disabled:opacity-50"
            >
              {create.isPending ? "Creating..." : "Create Webhook"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-sf-text-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {endpointList.map((ep) => (
          <div
            key={ep.id}
            className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sf-text-primary truncate">
                  {ep.url}
                </p>
                <p className="text-xs text-sf-text-muted mt-1">
                  Created {ep.createdAt ? timeAgo(ep.createdAt) : "recently"}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ep.events.map((event) => (
                    <span
                      key={event}
                      className="inline-block bg-sf-bg-tertiary text-sf-text-secondary text-xs px-2 py-0.5 rounded-sf font-code"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() =>
                    toggle.mutate({ id: ep.id, enabled: !ep.enabled })
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    ep.enabled ? "bg-sf-accent" : "bg-sf-bg-tertiary"
                  }`}
                  aria-label={ep.enabled ? "Disable webhook" : "Enable webhook"}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      ep.enabled ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
                <button
                  onClick={() => del.mutate(ep.id)}
                  className="text-sf-text-muted hover:text-sf-danger transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {endpointList.length === 0 && !endpoints.isLoading && (
          <div className="text-center py-12">
            <Webhook size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-secondary">
              No webhooks yet. Add one to receive real-time event notifications.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
