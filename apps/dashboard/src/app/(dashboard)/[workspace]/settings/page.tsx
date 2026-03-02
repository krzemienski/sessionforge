"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Settings, Save, Copy, Check } from "lucide-react";

export default function SettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();

  const ws = useQuery({
    queryKey: ["workspace", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces?slug=${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [scanPaths, setScanPaths] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (ws.data) {
      setName(ws.data.name || "");
      setSlug(ws.data.slug || "");
      setScanPaths((ws.data.scanPaths ?? []).join("\n"));
    }
  }, [ws.data]);

  const update = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/workspaces/${ws.data?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace"] }),
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const workspaceSlug = ws.data?.slug || workspace;
  const rssUrl = `/api/feed/${workspaceSlug}.xml`;
  const atomUrl = `/api/feed/${workspaceSlug}.atom`;

  if (ws.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Settings</h1>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">Workspace Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">Session Scan Paths</label>
          <textarea
            value={scanPaths}
            onChange={(e) => setScanPaths(e.target.value)}
            rows={4}
            placeholder="One path per line, e.g. ~/.claude/projects/"
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code resize-none focus:outline-none focus:border-sf-border-focus"
          />
          <p className="text-xs text-sf-text-muted mt-1">One path per line. Leave empty for default scan paths.</p>
        </div>

        <button
          onClick={() =>
            update.mutate({
              name,
              slug,
              scanPaths: scanPaths.split("\n").map((s) => s.trim()).filter(Boolean),
            })
          }
          disabled={update.isPending}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {update.isPending ? "Saving..." : "Save Changes"}
        </button>

        {update.isSuccess && <p className="text-sm text-sf-success">Settings saved.</p>}
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-4 mt-6">
        <div>
          <h2 className="text-base font-semibold text-sf-text-primary mb-1">RSS Feeds</h2>
          <p className="text-xs text-sf-text-muted">Subscribe to your workspace&apos;s published posts via RSS or Atom feeds.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">RSS 2.0</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={rssUrl}
              className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none"
            />
            <button
              onClick={() => handleCopy(rssUrl, "rss")}
              className="flex items-center gap-1.5 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-secondary hover:bg-sf-bg-hover hover:text-sf-text-primary transition-colors"
            >
              {copiedField === "rss" ? <Check size={14} className="text-sf-success" /> : <Copy size={14} />}
              {copiedField === "rss" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">Atom</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={atomUrl}
              className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none"
            />
            <button
              onClick={() => handleCopy(atomUrl, "atom")}
              className="flex items-center gap-1.5 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-secondary hover:bg-sf-bg-hover hover:text-sf-text-primary transition-colors"
            >
              {copiedField === "atom" ? <Check size={14} className="text-sf-success" /> : <Copy size={14} />}
              {copiedField === "atom" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
