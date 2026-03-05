"use client";

import { useState, useCallback } from "react";
import { Loader2, RefreshCw, Copy, Check, Pencil, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface SupplementaryItem {
  id: string;
  postId: string;
  workspaceId: string;
  contentType: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface SupplementaryPanelProps {
  postId: string;
  workspace: string;
}

// ── Type config ─────────────────────────────────────────────────────────────

const SUPPLEMENTARY_TYPES = [
  { id: "twitter_thread", label: "Twitter/X Thread", icon: "\uD835\uDD4F" },
  { id: "linkedin_post", label: "LinkedIn Post", icon: "in" },
  { id: "newsletter_excerpt", label: "Newsletter Excerpt", icon: "\u2709" },
  { id: "executive_summary", label: "Executive Summary", icon: "\u2261" },
  { id: "pull_quotes", label: "Pull Quotes", icon: "\u201C" },
  { id: "slide_outline", label: "Slide Outline", icon: "\u25A8" },
  { id: "evidence_highlights", label: "Evidence Highlights", icon: "\u2316" },
] as const;

function getTypeConfig(typeId: string) {
  return SUPPLEMENTARY_TYPES.find((t) => t.id === typeId);
}

function getTweetCount(content: string): number {
  const tweetPattern = /^\d+[/)/.\s]/m;
  const matches = content.match(new RegExp(tweetPattern.source, "gm"));
  return matches?.length ?? 0;
}

// ── Card component ──────────────────────────────────────────────────────────

interface SupplementaryCardProps {
  item: SupplementaryItem;
  onUpdate: (id: string, content: string) => Promise<void>;
  onRegenerate: (id: string) => Promise<void>;
}

function SupplementaryCard({ item, onUpdate, onRegenerate }: SupplementaryCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const config = getTypeConfig(item.contentType);
  const charCount = item.content.length;
  const isTwitter = item.contentType === "twitter_thread";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [item.content]);

  const handleStartEdit = useCallback(() => {
    setEditContent(item.content);
    setEditing(true);
  }, [item.content]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditContent(item.content);
  }, [item.content]);

  const handleSaveEdit = useCallback(async () => {
    setSaving(true);
    try {
      await onUpdate(item.id, editContent);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [item.id, editContent, onUpdate]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      await onRegenerate(item.id);
    } finally {
      setRegenerating(false);
    }
  }, [item.id, onRegenerate]);

  return (
    <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm" aria-hidden="true">
            {config?.icon ?? "?"}
          </span>
          <span className="text-xs font-medium text-sf-text-primary">
            {config?.label ?? item.contentType}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isTwitter && (
            <span className="text-[10px] text-sf-text-muted bg-sf-bg-secondary px-1.5 py-0.5 rounded">
              {getTweetCount(item.content)} tweets
            </span>
          )}
          <span className="text-[10px] text-sf-text-muted bg-sf-bg-secondary px-1.5 py-0.5 rounded">
            {charCount} chars
          </span>
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={8}
            className="w-full bg-sf-bg-secondary border border-sf-border-focus rounded-sf px-3 py-2 text-xs text-sf-text-primary resize-y focus:outline-none"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleCancelEdit}
              className="px-2.5 py-1 text-xs text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-sf-accent text-sf-bg-primary rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-sf-text-secondary line-clamp-3 leading-relaxed mb-2">
          {item.content}
        </p>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-1 pt-1 border-t border-sf-border mt-2">
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[11px] rounded-sf transition-colors",
              copied
                ? "text-sf-success"
                : "text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-secondary"
            )}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-secondary rounded-sf transition-colors"
          >
            <Pencil size={11} />
            Edit
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-secondary rounded-sf transition-colors disabled:opacity-50"
          >
            {regenerating ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-3xl mb-3 opacity-40">
          {"\u2728"}
        </div>
        <p className="text-sm text-sf-text-muted">No supplementary content yet.</p>
        <p className="text-xs text-sf-text-muted mt-1">
          Click &ldquo;Generate All&rdquo; to create derivative content.
        </p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function SupplementaryPanel({ postId, workspace }: SupplementaryPanelProps) {
  const [items, setItems] = useState<SupplementaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch items on mount
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/content/${postId}/supplementary`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load" }));
        setFetchError(err.error ?? "Failed to load supplementary content");
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setFetchError("Failed to load supplementary content");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // Trigger fetch on mount using a ref-based approach to avoid useEffect lint issues
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    fetchItems();
  }

  const handleGenerateAll = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/content/${postId}/supplementary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types: ["all"] }),
      });
      if (!res.ok) return;
      const data = await res.json();
      // Merge new items with existing ones (replace same types, add new)
      setItems((prev) => {
        const existing = new Map(prev.map((i) => [i.contentType, i]));
        for (const newItem of data.items ?? []) {
          existing.set(newItem.contentType, newItem);
        }
        return Array.from(existing.values());
      });
    } finally {
      setGenerating(false);
    }
  }, [postId]);

  const handleUpdate = useCallback(
    async (suppId: string, content: string) => {
      const res = await fetch(
        `/api/content/${postId}/supplementary/${suppId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      if (!res.ok) return;
      const updated = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === suppId ? { ...i, ...updated } : i))
      );
    },
    [postId]
  );

  const handleRegenerate = useCallback(
    async (suppId: string) => {
      const res = await fetch(
        `/api/content/${postId}/supplementary/${suppId}`,
        { method: "POST" }
      );
      if (!res.ok) return;
      const updated = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === suppId ? { ...i, ...updated } : i))
      );
    },
    [postId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="text-sf-accent animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <p className="text-xs text-red-400 mb-2">{fetchError}</p>
        <button
          onClick={fetchItems}
          className="text-xs text-sf-accent hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">
          Supplementary
        </h3>
        <button
          onClick={handleGenerateAll}
          disabled={generating}
          className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-3 py-1.5 rounded-sf font-medium text-xs hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          {generating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          Generate All
        </button>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {items.map((item) => (
            <SupplementaryCard
              key={item.id}
              item={item}
              onUpdate={handleUpdate}
              onRegenerate={handleRegenerate}
            />
          ))}
        </div>
      )}

      {/* Footer summary */}
      {items.length > 0 && (
        <div className="px-4 py-2 border-t border-sf-border text-xs text-sf-text-muted">
          {items.length} of {SUPPLEMENTARY_TYPES.length} types generated
        </div>
      )}
    </div>
  );
}
