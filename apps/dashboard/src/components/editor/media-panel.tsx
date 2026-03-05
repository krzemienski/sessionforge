"use client";

import { useState, useCallback } from "react";
import { Loader2, Trash2, Clipboard, Check, ImagePlus } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ContentAsset {
  id: string;
  postId: string;
  workspaceId: string;
  assetType: string;
  content: string;
  altText: string | null;
  caption: string | null;
  placement: { section?: string; position?: string } | null;
  metadata: {
    generatedAt?: string;
    model?: string;
    diagramType?: string;
  } | null;
  createdAt: string;
}

interface MediaPanelProps {
  postId: string;
  workspace: string;
}

// ── Diagram type badge colors ──────────────────────────────────────────────

const DIAGRAM_COLORS: Record<string, { bg: string; text: string }> = {
  flowchart: { bg: "bg-blue-500/15", text: "text-blue-400" },
  sequence: { bg: "bg-purple-500/15", text: "text-purple-400" },
  mindmap: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  timeline: { bg: "bg-amber-500/15", text: "text-amber-400" },
  pie: { bg: "bg-pink-500/15", text: "text-pink-400" },
  classDiagram: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  stateDiagram: { bg: "bg-orange-500/15", text: "text-orange-400" },
  erDiagram: { bg: "bg-indigo-500/15", text: "text-indigo-400" },
  gantt: { bg: "bg-rose-500/15", text: "text-rose-400" },
};

function getDiagramColor(diagramType: string) {
  return (
    DIAGRAM_COLORS[diagramType] ?? {
      bg: "bg-sf-accent/15",
      text: "text-sf-accent",
    }
  );
}

// ── Diagram card ───────────────────────────────────────────────────────────

interface DiagramCardProps {
  asset: ContentAsset;
  onRemove: (id: string) => void;
  removing: boolean;
}

function DiagramCard({ asset, onRemove, removing }: DiagramCardProps) {
  const [copied, setCopied] = useState(false);
  const diagramType = asset.metadata?.diagramType ?? "diagram";
  const color = getDiagramColor(diagramType);

  const previewLines = asset.content
    .split("\n")
    .slice(0, 3)
    .join("\n");

  const handleCopy = useCallback(async () => {
    const codeBlock = "```mermaid\n" + asset.content + "\n```";
    try {
      await navigator.clipboard.writeText(codeBlock);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-secure contexts
    }
  }, [asset.content]);

  return (
    <div className="rounded-sf border border-sf-border bg-sf-bg-tertiary p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color.bg} ${color.text}`}
        >
          {diagramType}
        </span>
        <button
          onClick={() => onRemove(asset.id)}
          disabled={removing}
          className="p-1 text-sf-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
          title="Remove diagram"
        >
          {removing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      </div>

      {/* Mermaid preview */}
      <pre className="text-[11px] text-sf-text-secondary bg-sf-bg-primary rounded-sf p-2 mb-2 overflow-hidden font-mono leading-relaxed whitespace-pre-wrap">
        {previewLines}
        {asset.content.split("\n").length > 3 && (
          <span className="text-sf-text-muted">{"\n..."}</span>
        )}
      </pre>

      {/* Caption */}
      {asset.caption && (
        <p className="text-xs text-sf-text-secondary mb-2 italic">
          {asset.caption}
        </p>
      )}

      {/* Insert button */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 w-full justify-center px-3 py-1.5 rounded-sf text-xs font-medium bg-sf-accent/10 text-sf-accent hover:bg-sf-accent/20 transition-colors"
      >
        {copied ? (
          <>
            <Check size={12} />
            Copied to Clipboard
          </>
        ) : (
          <>
            <Clipboard size={12} />
            Insert into Post
          </>
        )}
      </button>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-3xl mb-3 opacity-40">
          <ImagePlus size={32} className="mx-auto" />
        </div>
        <p className="text-sm text-sf-text-muted">No media assets yet.</p>
        <p className="text-xs text-sf-text-muted mt-1">
          Click &ldquo;Generate Diagrams&rdquo; to create Mermaid diagrams from
          your post content.
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MediaPanel({ postId, workspace }: MediaPanelProps) {
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch assets on first render
  const fetchAssets = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${postId}/media`);
      if (!res.ok) {
        throw new Error("Failed to load media assets");
      }
      const data = await res.json();
      setAssets(data.assets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [postId, fetched]);

  // Trigger fetch when component mounts (via useEffect equivalent)
  if (!fetched && !loading) {
    fetchAssets();
  }

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${postId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types: ["diagram"] }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error ?? "Failed to generate diagrams"
        );
      }
      const data = await res.json();
      const newAssets: ContentAsset[] = data.assets ?? [];
      setAssets((prev) => [...prev, ...newAssets]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Generation failed"
      );
    } finally {
      setGenerating(false);
    }
  }, [postId]);

  const handleRemove = useCallback(
    async (assetId: string) => {
      setRemovingId(assetId);
      try {
        const res = await fetch(`/api/content/${postId}/media`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });
        if (res.ok) {
          setAssets((prev) => prev.filter((a) => a.id !== assetId));
        }
      } catch {
        // Silently handle – the asset stays in the list
      } finally {
        setRemovingId(null);
      }
    },
    [postId]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Loader2 size={20} className="animate-spin text-sf-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Generate button */}
      <div className="p-3 border-b border-sf-border">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-sf text-sm font-medium bg-sf-accent text-sf-bg-primary hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating Diagrams...
            </>
          ) : (
            <>
              <ImagePlus size={14} />
              Generate Diagrams
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 p-2 rounded-sf bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      {assets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {assets.map((asset) => (
            <DiagramCard
              key={asset.id}
              asset={asset}
              onRemove={handleRemove}
              removing={removingId === asset.id}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {assets.length > 0 && (
        <div className="p-3 border-t border-sf-border text-xs text-sf-text-muted">
          {assets.length} diagram{assets.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
