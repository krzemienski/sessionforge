"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Save, PlayCircle, Copy, Check, Upload, Clock, FileCheck } from "lucide-react";

interface GeneralTabProps {
  workspace: string;
}

export function GeneralTab({ workspace }: GeneralTabProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const ws = useQuery({
    queryKey: ["workspace", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const uploadActivity = useQuery({
    queryKey: ["workspace", workspace, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/activity`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!workspace,
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
      const res = await fetch(`/api/workspace/${workspace}`, {
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
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const rssUrl = `${origin}/api/feed/${workspaceSlug}.xml`;
  const atomUrl = `${origin}/api/feed/${workspaceSlug}.atom`;

  if (ws.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">Workspace Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
        </div>
        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none focus:border-sf-border-focus" />
        </div>
        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">Session Scan Paths</label>
          <textarea value={scanPaths} onChange={(e) => setScanPaths(e.target.value)} rows={4} placeholder="One path per line, e.g. ~/.claude/projects/" className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code resize-none focus:outline-none focus:border-sf-border-focus" />
          <p className="text-xs text-sf-text-muted mt-1">One path per line. Leave empty for default scan paths.</p>
        </div>
        <button
          onClick={() => update.mutate({ name, slug, scanPaths: scanPaths.split("\n").map((s) => s.trim()).filter(Boolean) })}
          disabled={update.isPending}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {update.isPending ? "Saving..." : "Save Changes"}
        </button>
        {update.isSuccess && <p className="text-sm text-sf-success">Settings saved.</p>}
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <h2 className="text-base font-semibold font-display mb-1">Setup Wizard</h2>
        <p className="text-sm text-sf-text-secondary mb-4">Re-run the onboarding wizard to update your workspace configuration or connect new integrations.</p>
        <button onClick={() => router.push("/onboarding")} className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf font-medium text-sm hover:border-sf-border-focus transition-colors">
          <PlayCircle size={16} /> Resume Setup Wizard
        </button>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-sf-text-primary mb-1">RSS Feeds</h2>
          <p className="text-xs text-sf-text-muted">Subscribe to your workspace&apos;s published posts via RSS or Atom feeds.</p>
        </div>
        {[{ label: "RSS 2.0", url: rssUrl, field: "rss" }, { label: "Atom", url: atomUrl, field: "atom" }].map(({ label, url, field }) => (
          <div key={field}>
            <label className="block text-sm font-medium text-sf-text-secondary mb-1">{label}</label>
            <div className="flex items-center gap-2">
              <input readOnly value={url} className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary font-code focus:outline-none" />
              <button onClick={() => handleCopy(url, field)} className="flex items-center gap-1.5 px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-secondary hover:bg-sf-bg-hover hover:text-sf-text-primary transition-colors">
                {copiedField === field ? <Check size={14} className="text-sf-success" /> : <Copy size={14} />}
                {copiedField === field ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-sf-text-primary mb-1">Upload History</h2>
          <p className="text-xs text-sf-text-muted">Recent session file uploads to this workspace.</p>
        </div>
        {uploadActivity.isLoading ? (
          <div className="animate-pulse space-y-3"><div className="h-12 bg-sf-bg-tertiary rounded" /><div className="h-12 bg-sf-bg-tertiary rounded" /></div>
        ) : uploadActivity.data && uploadActivity.data.length > 0 ? (
          <div className="space-y-2">
            {uploadActivity.data.map((activity: any) => {
              const metadata = activity.metadata || {};
              return (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                  <Upload size={16} className="text-sf-text-secondary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium text-sf-text-primary">{metadata.filesUploaded || 0} {(metadata.filesUploaded || 0) === 1 ? "file" : "files"} uploaded</span>
                      <span className="text-xs text-sf-text-muted flex items-center gap-1"><Clock size={12} />{new Date(activity.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-sf-text-secondary">
                      {(metadata.sessionsNew || 0) > 0 && <span className="flex items-center gap-1"><FileCheck size={12} className="text-sf-success" />{metadata.sessionsNew} new</span>}
                      {(metadata.sessionsUpdated || 0) > 0 && <span className="flex items-center gap-1"><FileCheck size={12} className="text-sf-accent" />{metadata.sessionsUpdated} updated</span>}
                      {metadata.errors?.length > 0 && <span className="text-sf-error">{metadata.errors.length} {metadata.errors.length === 1 ? "error" : "errors"}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Upload size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-muted">No uploads yet</p>
            <p className="text-xs text-sf-text-muted mt-1">Upload session files from the Sessions page to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
